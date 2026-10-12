import { existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { runIsolated } from '../../src/utils/runIsolated';
import {
	alive,
	child,
	cleared,
	journal,
	pause,
	remembered,
	syntheticServices,
	type SyntheticServices
} from '../support/syntheticServices';

/**
 * What the runner does with what a command leaves: a vetted service that left the command is
 * handed to the system and never signalled, whatever way the command ended; a possible service
 * is not signalled either but fails the command; the command's own leftovers are still stopped.
 * Every process is a stand-in started by these tests.
 */
const mac = process.platform === 'darwin';
let made: SyntheticServices;
beforeAll(() => {
	if (mac) made = syntheticServices();
});
afterAll(async () => {
	if (mac) await cleared(made.home);
});

const prelude = `
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const dir = process.argv[1];
const start = (name, file, args, detached) => {
	const made = spawn(file, args, { detached, stdio: 'ignore' });
	made.unref();
	const when = execFileSync('/bin/ps', ['-p', String(made.pid), '-o', 'lstart=']).toString().trim();
	fs.writeFileSync(dir + '/' + name, made.pid + ' ' + when);
};
`;
const service = (seconds: number) =>
	`start('service', ${JSON.stringify(made.service)}, ['${seconds}', dir + '/journal'], true);`;
const leaves = (code: number) => `setTimeout(() => process.exit(${code}), 700);`;

/** A command that starts processes, under the runner with the made-up tools vouched for. */
async function ran(
	name: string,
	body: string,
	limits: { timeoutMs?: number; blind?: boolean } = {}
) {
	const dir = join(made.home, name);
	mkdirSync(dir);
	const result = await runIsolated({
		command: process.execPath,
		args: ['-e', prelude + body, dir],
		cwd: dir,
		env: { ...process.env },
		timeoutMs: limits.timeoutMs ?? 20_000,
		log: join(dir, 'run.log'),
		maxLogBytes: 64_000,
		platform: {
			authority: () => made.authority,
			table: limits.blind ? async () => null : undefined
		}
	});
	const started = (file: string) => {
		const [pid, ...when] = readFileSync(join(dir, file), 'utf8').split(' ');
		return remembered({ pid: Number(pid), started: when.join(' ') });
	};
	return { dir, result, started, log: readFileSync(join(dir, 'run.log'), 'utf8') };
}

test.skipIf(!mac)(
	'a vetted service that left a passing command is handed over, never signalled, and recorded',
	async () => {
		const { dir, result, started, log } = await ran('passing', service(5) + leaves(0));
		const handed = started('service');
		expect(result).toMatchObject({ status: 'passed', exitCode: 0, survivors: [] });
		expect(log).toContain(`process ${handed.pid} `);
		expect(log).toContain('handed over to the system');
		expect(alive(handed)).toBe(true);
		// Another build takes the service up after it was observed; nothing may reach it later.
		symlinkSync('/bin/sleep', join(dir, 'ibtool'));
		child(join(dir, 'ibtool'), ['2']);
		while (alive(handed)) await pause(200);
		expect(journal(join(dir, 'journal'))).toBe('retired\n');
	},
	30_000
);

test.skipIf(!mac)(
	'a failing command hands it over as well, and still fails',
	async () => {
		const { dir, result, started, log } = await ran('failing', service(6) + leaves(3));
		expect(result).toMatchObject({ status: 'failed', exitCode: 3, survivors: [] });
		expect(log).toContain('handed over to the system');
		expect(alive(started('service'))).toBe(true);
		expect(journal(join(dir, 'journal'))).toBe('');
	},
	30_000
);

test.skipIf(!mac)(
	"at its time limit a command's own processes are stopped and the service is not",
	async () => {
		const late = `spawn(process.execPath, ['-e', "setTimeout(() => require('fs').writeFileSync(process.argv[1], 'late'), 2500)", dir + '/late'], { stdio: 'ignore' });`;
		const hung = `${service(8)} ${late} setInterval(() => {}, 1000);`;
		const { dir, result, started } = await ran('hung', hung, { timeoutMs: 1200 });
		expect(result).toMatchObject({ status: 'timeout', timedOut: true, survivors: [] });
		await pause(3000);
		expect(existsSync(join(dir, 'late'))).toBe(false);
		expect(alive(started('service'))).toBe(true);
		expect(journal(join(dir, 'journal'))).toBe('');
	},
	30_000
);

test.skipIf(!mac)(
	"a possible service inside the command's group is reached by no group signal, and fails it",
	async () => {
		const inside = `start('possible', ${JSON.stringify(made.lookAlike)}, ['3', dir + '/journal'], false);`;
		const { dir, result, started, log } = await ran('inside', inside + leaves(0));
		const possible = started('possible');
		expect(result.status).toBe('failed');
		expect(result.survivors).toEqual([possible]);
		expect(log).toContain('left running, not signalled');
		while (alive(possible)) await pause(200);
		expect(journal(join(dir, 'journal'))).toBe('retired\n');
	},
	30_000
);

test.skipIf(!mac)(
	'when the processes cannot be read nothing is signalled and the command does not pass',
	async () => {
		const body = `${service(4)} start('own', '/bin/sleep', ['30'], true);` + leaves(0);
		const { dir, result, started, log } = await ran('blind', body, { blind: true });
		expect(result.status).toBe('failed');
		expect(log).toContain('could not be read');
		expect(alive(started('own'))).toBe(true);
		expect(journal(join(dir, 'journal'))).toBe('');
	},
	30_000
);

test.skipIf(!mac)(
	'an ordinary process left behind is still stopped and fails the command, Apple-signed or not',
	async () => {
		const plain = `start('plain', ${JSON.stringify(made.helper)}, ['30', dir + '/journal'], true);`;
		const body = `start('apple', '/bin/sleep', ['30'], true); ${plain}` + leaves(0);
		const { result, started, log } = await ran('leaks', body);
		expect(result.status).toBe('failed');
		expect(result.survivors).toHaveLength(2);
		expect(log).toContain('stopped');
		expect([alive(started('apple')), alive(started('plain'))]).toEqual([false, false]);
	},
	30_000
);
