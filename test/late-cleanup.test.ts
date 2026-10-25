import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { classifyProcess } from '../src/utils/platformServices';
import { processTable, type TrackedProcess } from '../src/utils/processDescendants';
import { runIsolated } from '../src/utils/run-isolated/runIsolated';
import {
	adopted,
	alive,
	cleared,
	journal,
	pause,
	remembered,
	syntheticServices,
	type SyntheticServices
} from './support/syntheticServices';

/**
 * What answers late must do nothing, and a look that is given up must be ended itself. An
 * observation that the runner stopped waiting for may still answer afterwards; a tool that a
 * probe started may still be running when the probe has answered. Neither may leave anything
 * behind: no signal after the runner's result, no tool after the probe's. Every process is a
 * stand-in started by these tests, and every tool is a script of theirs.
 */
const mac = process.platform === 'darwin';
let made: SyntheticServices;
beforeAll(() => {
	if (mac) made = syntheticServices();
});
afterAll(async () => {
	if (mac) await cleared(made.home);
});

const identified = (line: string): TrackedProcess => {
	const [pid, ...when] = line.trim().split(' ');
	return { pid: Number(pid), started: when.join(' ') };
};
/** The answer, or 'never' when it has not come in the time given. */
const bounded = <T>(work: Promise<T>, milliseconds: number) =>
	Promise.race([work, pause(milliseconds).then(() => 'never' as const)]);
/** Whether every one of these processes has ended, looked for over two seconds. */
async function gone(known: TrackedProcess[]): Promise<boolean> {
	for (let waited = 0; waited < 2000 && known.some(alive); waited += 100) await pause(100);
	return !known.some(alive);
}

/**
 * A disposable tool: it writes down its own id and start time, and then does not end by itself.
 * Whoever started it has to end it.
 */
function tool(name: string) {
	const record = join(made.home, `${name}.record`);
	const script = join(made.home, `${name}.sh`);
	const own = `echo "$$ $(/bin/ps -p $$ -o lstart=)" >> ${JSON.stringify(record)}`;
	writeFileSync(script, `#!/bin/sh\n${own}\nexec /bin/sleep 60\n`);
	chmodSync(script, 0o755);
	const started = () =>
		existsSync(record)
			? readFileSync(record, 'utf8').trim().split('\n').map(identified).map(remembered)
			: [];
	return { script, started };
}

test.skipIf(!mac)(
	'an observation that answers only after the runner has answered signals nothing',
	async () => {
		const dir = join(made.home, 'late');
		mkdirSync(dir);
		const script = [
			"const fs = require('fs'), { spawn, execFileSync } = require('child_process');",
			'const dir = process.argv[1];',
			"process.on('SIGTERM', () => fs.appendFileSync(dir + '/command.journal', 'signalled\\n'));",
			`const helper = spawn(${JSON.stringify(made.helper)}, ['60', dir + '/helper.journal'], { stdio: 'ignore' });`,
			"const when = (pid) => execFileSync('/bin/ps', ['-p', String(pid), '-o', 'lstart=']).toString().trim();",
			"const both = [process.pid, helper.pid].map((pid) => pid + ' ' + when(pid));",
			"fs.writeFileSync(dir + '/started', both.join('\\n'));",
			'setInterval(() => {}, 1000);'
		].join('\n');
		// The processes are read as they are until shortly before the limit; from then on every
		// read is held, and is answered only when this test lets it go.
		let held = false;
		const waiting: (() => void)[] = [];
		const table = async () => {
			if (held) await new Promise<void>((release) => waiting.push(release));
			return processTable();
		};
		setTimeout(() => (held = true), 900);
		const answered = await bounded(
			runIsolated({
				command: process.execPath,
				args: ['-e', script, dir],
				cwd: dir,
				env: { ...process.env },
				timeoutMs: 1200,
				log: join(dir, 'run.log'),
				maxLogBytes: 64_000,
				platform: { authority: () => made.authority, table, cleanupMs: 1000 }
			}),
			12_000
		);
		const [command, helper] = readFileSync(join(dir, 'started'), 'utf8')
			.split('\n')
			.map(identified)
			.map(remembered);
		// Only now do the held observations answer, with the processes as they really are.
		held = false;
		for (const release of waiting.splice(0)) release();
		await pause(3500);
		expect.soft(answered).toMatchObject({ status: 'timeout', timedOut: true });
		expect
			.soft([journal(join(dir, 'command.journal')), journal(join(dir, 'helper.journal'))])
			.toEqual(['', '']);
		expect.soft([alive(command), alive(helper)]).toEqual([true, true]);
	},
	60_000
);

test.skipIf(!mac)(
	'a look that is late is ended itself: its tool is gone, not only its answer given up',
	async () => {
		const { processProbes } = await import('../src/utils/processProbes');
		const late = tool('late-tool');
		const began = Date.now();
		// Use the installed interpreter so fresh-script admission cannot consume the probe limit.
		const answer = await processProbes({ timeoutMs: 500 }).ran('/bin/sh', [late.script]);
		const started = late.started();
		expect(answer.ok).toBe(false);
		expect(Date.now() - began).toBeLessThan(4000);
		expect(started).toHaveLength(1);
		expect(await gone(started)).toBe(true);
	},
	30_000
);

test.skipIf(!mac)(
	'a look that is cancelled is ended itself: its tool was running and is gone',
	async () => {
		const { processProbes } = await import('../src/utils/processProbes');
		const cancelled = tool('cancelled-tool');
		const control = new AbortController();
		const running = processProbes({ signal: control.signal }).ran('/bin/sh', [cancelled.script]);
		for (let waited = 0; waited < 5000 && cancelled.started().length === 0; waited += 50)
			await pause(50);
		const started = cancelled.started();
		expect(started).toHaveLength(1);
		expect(alive(started[0])).toBe(true);
		control.abort();
		expect((await running).ok).toBe(false);
		expect(await gone(started)).toBe(true);
	},
	30_000
);

test.skipIf(!mac)(
	"a judgement whose look never answers ends with that look's tool, and protects the process",
	async () => {
		// The judgement looks at a process with `ps`. Here `ps` is a tool of this test that never
		// answers; the process that is judged is an ordinary stand-in.
		const stuck = tool('stuck-ps');
		const tools = join(made.home, 'stuck-tools');
		mkdirSync(tools);
		symlinkSync(stuck.script, join(tools, 'ps'));
		const judgedProcess = adopted(made.helper, ['60', join(made.home, 'judged.journal')]);
		const path = process.env.PATH;
		process.env.PATH = `${tools}:${path}`;
		const judging = classifyProcess(judgedProcess, { authority: () => made.authority, group: 1 });
		const verdict = await bounded(judging, 9000).finally(() => (process.env.PATH = path));
		const started = stuck.started();
		expect.soft(verdict).toMatchObject({ standing: 'protected' });
		expect.soft(started.length).toBeGreaterThan(0);
		expect.soft(await gone(started)).toBe(true);
		expect.soft(journal(join(made.home, 'judged.journal'))).toBe('');
	},
	60_000
);
