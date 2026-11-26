import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { expect } from '../verificationExpect';
import { runHarness } from './cli';

export async function proveTrackerRehearsal(root: string, home: string) {
	const database = join(home, 'copy.sqlite');
	await writeFile(database, '', { mode: 0o600 });
	const args = ['tracker', 'rehearse', database, '--node', 'fixture-mac'];
	const cli = join(root, 'src/index.ts');
	const env = { HOME: home, HARNESS_TRACKER_LEGACY_BIN: '/dev/null/tracker' };
	const candidate = spawn('bun', [cli, ...args], {
		cwd: home,
		env: { ...process.env, ...env },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	const output = createInterface({ input: candidate.stdout });
	const exited = once(candidate, 'exit');
	try {
		const [line] = await Promise.race([
			once(output, 'line'),
			exited.then(([code]) => {
				throw new Error(`Tracker rehearsal exited before readiness (${code})`);
			})
		]);
		const ready = JSON.parse(line);
		expect(ready).toMatchObject({ node: 'fixture-mac', pid: candidate.pid });
		// The assigned port must be one `--port` accepts; Linux assigns ephemeral ports below this.
		expect(ready.port).toBeGreaterThanOrEqual(49152);
		const base = `http://127.0.0.1:${ready.port}`;
		await expectTrackerRehearsalStatus(base, candidate.pid!);
		const duplicate = await runHarness([...args, '--port', String(ready.port)], home, false, env);
		expect(duplicate.exitCode).toBe(1);
		const secondOwner = await runHarness(args, home, false, env);
		expect(secondOwner.exitCode).toBe(1);
		const livePort = await runHarness([...args, '--port', '7701'], home, false, env);
		expect(livePort.exitCode).toBe(2);
		await writeTrackerRehearsalItem(base);
	} finally {
		output.close();
		candidate.kill('SIGTERM');
		await exited;
	}
	const stopped = new DatabaseSync(database, { readOnly: true });
	try {
		expect(stopped.prepare('SELECT title FROM items').all()).toEqual([
			{ title: 'Rehearsal journal canary' }
		]);
	} finally {
		stopped.close();
	}
}

async function expectTrackerRehearsalStatus(base: string, pid: number) {
	expect(await (await fetch(base + '/health')).json()).toMatchObject({
		app: 'tracker',
		pid,
		node: 'fixture-mac'
	});
	expect(await (await fetch(base + '/status')).json()).toMatchObject({
		node: 'fixture-mac',
		role: 'spoke',
		pid,
		db_id: expect.any(String),
		ops: 0,
		sync: { disabled: true },
		deliveries: {},
		active_reminders: 0
	});
}

async function writeTrackerRehearsalItem(base: string) {
	const crossOrigin = await fetch(base + '/items', {
		method: 'POST',
		headers: { origin: 'https://fixture.invalid' },
		body: JSON.stringify({ title: 'Rejected cross-origin request' })
	});
	expect(crossOrigin.status).toBe(403);
	const response = await fetch(base + '/items', {
		method: 'POST',
		body: JSON.stringify({ title: 'Rehearsal journal canary' })
	});
	expect(response.status).toBe(201);
}
