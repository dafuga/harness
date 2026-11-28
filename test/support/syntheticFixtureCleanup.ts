import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TrackedProcess } from '../../src/utils/processDescendants';
import { fixtureProcessTable, killFixtureProcess } from './syntheticProcessTable';
import { sweepSyntheticServices, wrapperHome } from './sweepSyntheticServices';

const receipts = (home: string) => join(home, '.processes');

export function recordFixtureProcess(home: string, { pid, started }: TrackedProcess): void {
	// Persist ownership before returning to the test. The watchdog can read it if the worker dies.
	appendFileSync(receipts(home), `${pid} ${started}\n`, { mode: 0o600 });
}

export function stopFixtureProcesses(home: string): void {
	if (!existsSync(home)) return;
	const file = receipts(home);
	const ids = new Set(existsSync(file) ? readFileSync(file, 'utf8').split('\n') : []);
	const rows = fixtureProcessTable();
	const owned = rows.filter(
		(row) =>
			ids.has(`${row.pid} ${row.started}`) ||
			row.command.startsWith(`${home}/`) ||
			wrapperHome(row.command) === home
	);
	const stopped = new Set<number>();
	for (const row of owned) {
		if (row.pid > 1 && row.pid === row.group && killFixtureProcess(row, true)) stopped.add(row.pid);
	}
	for (const row of owned) {
		if (!stopped.has(row.group)) killFixtureProcess(row, false);
	}
}

const watchdogPath = fileURLToPath(new URL('./syntheticFixtureCleanup.ts', import.meta.url));

/** An independent watchdog sees EOF even when the worker is killed without running its hooks. */
export function watchFixture(home: string): () => Promise<void> {
	sweepSyntheticServices();
	const watchdog = spawn('bun', [watchdogPath, home], {
		detached: true,
		stdio: ['pipe', 'ignore', 'inherit']
	});
	const closed = new Promise<void>((resolve, reject) => {
		watchdog.once('error', reject);
		watchdog.once('exit', (code) =>
			code === 0 ? resolve() : reject(new Error(`Fixture watchdog exited with status ${code}`))
		);
	});
	void closed.catch(() => undefined);
	watchdog.stdin.on('error', () => undefined);
	if (watchdog.stdin instanceof Socket) watchdog.stdin.unref();
	watchdog.unref();
	return async () => {
		watchdog.stdin.end();
		await closed;
	};
}

function checkedHome(home: string | undefined): string {
	if (
		!home ||
		dirname(home) !== realpathSync(tmpdir()) ||
		!/^harness-services-[\w]+$/.test(basename(home))
	) {
		throw new Error('Expected a synthetic service fixture directory');
	}
	const stat = lstatSync(home);
	if (!stat.isDirectory() || stat.uid !== process.getuid?.() || (stat.mode & 0o077) !== 0) {
		throw new Error('Expected a private synthetic service fixture directory');
	}
	return home;
}

if (import.meta.main) {
	const home = checkedHome(process.argv[2]);
	process.stdin.once('end', () => {
		stopFixtureProcesses(home);
		rmSync(home, { recursive: true, force: true });
	});
	process.stdin.resume();
}
