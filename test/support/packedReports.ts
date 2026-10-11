import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand, type CommandResult } from './cli';
import { freePort } from './workers';

export interface PackedInstall {
	/** The temporary directory that holds the packed package, its report store and fixtures. */
	root: string;
	run(args: string[]): Promise<CommandResult>;
	/** Restores the environment and removes the directory; safe to call more than once. */
	dispose(): Promise<void>;
}

export interface ServedReports {
	url: string;
	port: number;
	/** The server process this start created. */
	pid: number;
}

/** True while a process with this id exists; signal 0 only asks. */
export function running(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** True when something answers on the loopback address. */
export function listening(url: string): Promise<boolean> {
	return fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1_000) }).then(
		() => true,
		() => false
	);
}

/** Packs Harness and installs the tarball beside a report store of its own. */
export async function packedInstall(): Promise<PackedInstall> {
	const root = await mkdtemp(join(tmpdir(), 'harness-packed-'));
	const previous = process.env.PROJECT_REPORTS_HOME;
	process.env.PROJECT_REPORTS_HOME = join(root, 'store');
	const tarball = join(root, 'harness.tgz');
	await runCommand(['bun', 'pm', 'pack', '--ignore-scripts', '--filename', tarball], process.cwd());
	await runCommand(['tar', '-xzf', tarball, '-C', root], root);
	await runCommand(['bun', 'install', '--ignore-scripts'], join(root, 'package'));
	const cli = join(root, 'package', 'dist', 'index.js');
	let disposed = false;
	return {
		root,
		run: (args) => runCommand(['bun', cli, ...args], root),
		async dispose() {
			if (disposed) return;
			disposed = true;
			if (previous === undefined) delete process.env.PROJECT_REPORTS_HOME;
			else process.env.PROJECT_REPORTS_HOME = previous;
			await rm(root, { recursive: true, force: true });
		}
	};
}

/**
 * Starts the report server of a packed install on a free port, hands it to `use`, and then
 * stops that exact server through the command that started it, whether `use` returned or threw.
 */
export async function withReportServer<Result>(
	install: PackedInstall,
	use: (server: ServedReports) => Promise<Result>
): Promise<Result> {
	const port = await freePort();
	const started = await install.run(['report', 'serve', '--port', String(port)]);
	const server = JSON.parse(started.stdout) as ServedReports;
	try {
		return await use(server);
	} finally {
		await install.run(['report', 'stop', '--port', String(server.port)]);
	}
}
