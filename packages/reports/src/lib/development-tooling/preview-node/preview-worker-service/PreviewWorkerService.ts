// @harness-uid u_edxqiri65j
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { commandEnvironment } from '../../../../../../../src/adapters/execution-runtimes/BoundedCommandAdapter';
import { setTimeout as delay } from 'node:timers/promises';
import { readPreviewHealth } from './previewHealth';
import type { PreviewHandle } from '../../../../services/accounts-access/preview-server-service/PreviewServerService';

/** A single recoverable worker; the separate supervisor retains the ownership listener. */
export class PreviewWorkerService {
	private child: ChildProcess | null = null;
	private stopping: Promise<void> | null = null;
	private token = '';
	private stopped = false;
	private misses = 0;
	private retries = 0;
	private healthySince = Date.now();
	private timer: ReturnType<typeof setTimeout> | undefined;
	constructor(
		private entry: string,
		private args: string[],
		private url: string
	) {}
	async start(): Promise<PreviewHandle> {
		await this.launch();
		this.schedule();
		return { url: this.url, close: () => this.close() };
	}
	async close(): Promise<void> {
		this.stopped = true;
		clearTimeout(this.timer);
		await this.stop();
	}
	private async launch() {
		if (this.stopped) throw new Error('Preview stopped.');
		this.token = randomUUID();
		const child = spawn('node', [this.entry, ...this.args], {
			stdio: 'inherit',
			env: previewWorkerEnvironment(this.token)
		});
		this.child = child;
		let failure = '';
		child.once('error', (cause) => (failure = cause.message));
		const deadline = Date.now() + 20000;
		while (!this.stopped && Date.now() < deadline) {
			if (failure || child.exitCode !== null || child.signalCode !== null)
				throw new Error(failure || 'Preview worker exited before readiness.');
			try {
				if ((await readPreviewHealth(this.url, this.token)).pid === child.pid) return;
			} catch {
				/* Startup and Vite restart may temporarily close the listener. */
			}
			await delay(100);
		}
		throw new Error('Preview worker did not become ready.');
	}
	private schedule() {
		if (!this.stopped) this.timer = setTimeout(() => void this.check(), 1500);
	}
	private async check() {
		try {
			const health = await readPreviewHealth(this.url, this.token);
			if (health.pid !== this.child?.pid) throw new Error('Worker identity changed.');
			this.misses = health.errors >= 3 && !health.busy ? this.misses + 1 : 0;
			if (!this.misses && Date.now() - this.healthySince > 30000) this.retries = 0;
		} catch {
			this.misses++;
		}
		if (this.misses >= 3 && !this.stopped) await this.recover();
		this.schedule();
	}
	private async recover() {
		console.warn('Harness preview worker unhealthy; recovering at the same address.');
		try {
			await this.stop();
			await delay(Math.min(30000, 250 * 2 ** Math.min(this.retries++, 7)));
			await this.launch();
			this.misses = 0;
			this.healthySince = Date.now();
			console.log('Harness preview worker recovered: ' + this.url);
		} catch (cause) {
			if (!this.stopped) console.warn('Harness preview recovery will retry: ' + String(cause));
		}
	}
	private async stop() {
		const pending = (this.stopping ??= this.stopChild());
		try {
			await pending;
		} finally {
			if (this.stopping === pending) this.stopping = null;
		}
	}
	private async stopChild() {
		const child = this.child;
		this.child = null;
		if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
		await new Promise<void>((finish) => {
			const force = setTimeout(() => child.kill('SIGKILL'), 2000);
			child.once('exit', () => {
				clearTimeout(force);
				finish();
			});
			child.kill('SIGTERM');
		});
	}
}

/** Deliberate preview configuration only; provider credentials stay in scoped stores. */
function previewWorkerEnvironment(token: string): Record<string, string | undefined> {
	const env = commandEnvironment({ HARNESS_PREVIEW_WORKER_TOKEN: token });
	for (const key of [
		'BODY_SIZE_LIMIT',
		'HOST',
		'PORT',
		'ORIGIN',
		'ADDRESS_HEADER',
		'PROTOCOL_HEADER',
		'HOST_HEADER',
		'PORT_HEADER',
		'XFF_DEPTH',
		'SHUTDOWN_TIMEOUT',
		'IDLE_TIMEOUT',
		'NODE_ENV',
		'NO_COLOR',
		'FORCE_COLOR',
		'HARNESS_ANALYTICS_HOME',
		'HARNESS_BIND',
		'HARNESS_BUN_PATH',
		'HARNESS_CLI_PATH',
		'HARNESS_CONSOLE_DATA',
		'HARNESS_OWNER_MODE',
		'HARNESS_PREVIEW_OWNER_PORT',
		'HARNESS_REPORTS_RUNTIME_ROOT',
		'HARNESS_SITE_ROOT',
		'HARNESS_VERIFY',
		'HARNESS_VERIFY_REVISION',
		'PROJECT_REPORTS_ASSET_STORAGE',
		'PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME',
		'PROJECT_REPORTS_CONFIG_FILE',
		'PROJECT_REPORTS_FFMPEG',
		'PROJECT_REPORTS_HOME',
		'PROJECT_REPORTS_PAGES_PROJECT'
	])
		if (process.env[key] !== undefined) env[key] = process.env[key];
	return env;
}
