import { reportBuildIdentity } from "../../utils/reportBuildIdentity";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { reportRuntimeRoot } from "../../utils/reportRuntimeRoot";
import { ReportRepository } from "../../repositories/report-repository/ReportRepository";
import { processStarted, reportServerRecord, type StoppedServer } from "../../utils/reportServerRecord";
import { stopReportServer } from "./reportServerRecord";

const appRoot = reportRuntimeRoot();

export class ReportServerService {
	constructor(private readonly repository = new ReportRepository()) {}
	async serve(preferred = 5588) {
		const identity = createHash('sha256').update(this.repository.root).digest('hex');
		for (let port = preferred; port < preferred + 30; port++) {
			const existing = await this.health(port);
			if (this.matches(existing, identity)) return this.reused(port);
			if (existing || (await this.occupied(port))) continue;
			return this.started(port, identity);
		}
		throw new Error('No available loopback port from preferred range');
	}
	private async reused(port: number) {
		const known = await reportServerRecord(this.repository.root, port).read();
		return { port, reused: true, url: this.url(port), pid: known?.pid };
	}
	/** Starts a server and has the store remember it, so that `report stop` ends exactly it. */
	private async started(port: number, identity: string) {
		const pid = this.start(port);
		if (!(await this.waitReady(port, identity)))
			throw new Error(`Report server failed to start on port ${port}`);
		const started = (await processStarted(pid)) ?? '';
		const record = { pid, port, started, buildId: this.build() };
		await reportServerRecord(this.repository.root, port).write(record);
		return { port, reused: false, url: this.url(port), pid };
	}
	/** Ends the server this store started on the port; a server of anything else is left alone. */
	stop(port = 5588): Promise<StoppedServer> {
		return stopReportServer(this.repository.root, port);
	}
	private build(): string {
		return reportBuildIdentity(resolve(appRoot, 'build'));
	}
	private matches(
		health: { app?: string; root?: string; buildId?: string } | null,
		identity: string
	): boolean {
		return (
			health?.app === 'project-reports' &&
			health.root === identity &&
			health.buildId === this.build()
		);
	}
	private start(port: number): number {
		const child = spawn(process.execPath, [resolve(appRoot, 'build', 'index.js')], {
			cwd: appRoot,
			env: {
				...process.env,
				HOST: '127.0.0.1',
				PORT: String(port),
				BODY_SIZE_LIMIT: '110M',
				// This server is started for the local owner and listens on loopback only.
				// The server shows the application it was started for, and no other.
				HARNESS_SITE_ROOT: process.env.HARNESS_SITE_ROOT ?? process.cwd(),
				HARNESS_OWNER_MODE: 'loopback',
				HARNESS_BIND: '127.0.0.1'
			},
			detached: true,
			stdio: 'ignore'
		});
		child.unref();
		return child.pid ?? -1;
	}
	private async waitReady(port: number, identity: string) {
		for (let attempt = 0; attempt < 40; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 250));
			const ready = await this.health(port);
			if (this.matches(ready, identity)) return true;
		}
		return false;
	}
	private url(port: number) {
		return `http://127.0.0.1:${port}`;
	}
	private async health(
		port: number
	): Promise<{ app?: string; root?: string; buildId?: string } | null> {
		try {
			const response = await fetch(this.url(port) + '/api/health', {
				signal: AbortSignal.timeout(750)
			});
			return response.ok
				? ((await response.json()) as { app?: string; root?: string; buildId?: string })
				: null;
		} catch {
			return null;
		}
	}
	private async occupied(port: number) {
		return new Promise<boolean>((resolve) => {
			const socket = createConnection({ host: '127.0.0.1', port });
			socket.once('connect', () => {
				socket.destroy();
				resolve(true);
			});
			socket.once('error', () => resolve(false));
			socket.setTimeout(700, () => {
				socket.destroy();
				resolve(true);
			});
		});
	}
}
