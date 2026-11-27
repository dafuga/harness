import { execFileSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { workerScript } from '../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedWorkerProcess';

const pane = 'auto-hyg123-r1';
const token = 'b'.repeat(64);
const sleep = '/bin/sleep';

export function findHygieneTmux() {
	return ['/opt/homebrew/bin/tmux', '/usr/local/bin/tmux', '/usr/bin/tmux'].find(existsSync);
}

export function hygieneFixture(root: string, tmux: string) {
	const ledger = join(root, 'hygiene');
	mkdirSync(ledger, { mode: 0o700 });
	const worker = join(root, 'worker');
	const harness = join(root, 'harness');
	const job = join(root, 'job');
	const socket = basename(root);
	const command = (args: string[]) =>
		execFileSync(tmux, ['-L', socket, ...args], { stdio: 'ignore', timeout: 5000 });
	writeFixturePrograms({ root, worker, harness, job });
	const env = {
		HOME: root,
		HARNESS_EXECUTABLE: harness,
		HARNESS_TRACKER_HYGIENE: ledger,
		HARNESS_TRACKER_MAX_RUN_MINUTES: '1',
		HARNESS_TRACKER_TMUX: tmux,
		HARNESS_TRACKER_SOCKET: socket,
		HARNESS_TRACKER_PANE: pane
	};
	const report = () => {
		const file = join(ledger, 'cleanup.json');
		if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
	};
	return {
		start() {
			command([
				'-f',
				'/dev/null',
				'new-session',
				'-d',
				'-s',
				pane,
				'-e',
				'HARNESS_TRACKER_ATTEMPT=' + token,
				'/usr/bin/env',
				...Object.entries(env).map(([name, value]) => name + '=' + value),
				'/bin/sh',
				worker,
				root,
				token,
				'/bin/sh',
				job
			]);
		},
		stop() {
			try {
				command(['kill-session', '-t', '=' + pane]);
			} catch {
				/* Already stopped. */
			}
		},
		async waitForCleanup() {
			for (let attempt = 0; attempt < 25 && !report(); attempt++) await delay(200);
		},
		report,
		processAlive: processIsRunning
	};
}

function writeFixturePrograms({
	root,
	worker,
	harness,
	job
}: Record<'root' | 'worker' | 'harness' | 'job', string>) {
	writeFileSync(worker, workerScript, { mode: 0o700 });
	writeFileSync(
		harness,
		`#!/bin/sh\nexec "${execFileSync('/bin/sh', ['-c', 'command -v bun'], { encoding: 'utf8' }).trim()}" "${resolve('src/cli/index.ts')}" "$@"\n`,
		{ mode: 0o700 }
	);
	writeFileSync(job, fixtureJob(root), { mode: 0o700 });
}

function fixtureJob(root: string) {
	return `#!/bin/sh
set -eu
"$HARNESS_EXECUTABLE" hygiene process -- /bin/sh -c '${sleep} 90 & echo $! > "$1"; wait' -- '${join(root, 'owned-pid')}'
while [ ! -d '${join(root, 'release')}' ]; do
	${sleep} 0.1
done
`;
}

function processIsRunning(pid: number) {
	try {
		const state = execFileSync('/bin/ps', ['-p', String(pid), '-o', 'stat='], {
			encoding: 'utf8'
		}).trim();
		return state.length > 0 && !state.startsWith('Z');
	} catch {
		return false;
	}
}
