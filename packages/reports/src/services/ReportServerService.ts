import { reportBuildIdentity } from '../utils/reportBuildIdentity';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { reportRuntimeRoot } from '../utils/reportRuntimeRoot';
import { ReportRepository } from '../repositories/ReportRepository';
const appRoot = reportRuntimeRoot();
export class ReportServerService {
	constructor(private readonly repository = new ReportRepository()) {}
	async serve(preferred = 5588) {
		const identity = createHash('sha256').update(this.repository.root).digest('hex');
		for (let port = preferred; port < preferred + 30; port++) {
			const existing = await this.health(port);
			if (this.matches(existing, identity)) return { port, reused: true, url: this.url(port) };
			if (existing || (await this.occupied(port))) continue;
			this.start(port);
			if (await this.waitReady(port, identity)) return { port, reused: false, url: this.url(port) };
			throw new Error(`Report server failed to start on port ${port}`);
		}
		throw new Error('No available loopback port from preferred range');
	}
	private matches(
		health: { app?: string; root?: string; buildId?: string } | null,
		identity: string
	): boolean {
		return (
			health?.app === 'project-reports' &&
			health.root === identity &&
			health.buildId === reportBuildIdentity()
		);
	}
	private start(port: number) {
		const child = spawn(process.execPath, [resolve(appRoot, 'build', 'index.js')], {
			cwd: appRoot,
			env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), BODY_SIZE_LIMIT: '110M' },
			detached: true,
			stdio: 'ignore'
		});
		child.unref();
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
