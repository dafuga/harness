import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { withTempDir } from './support/temporary';
import { searchLoops } from '../src/cli/program/loopSearch';
import { nextLoopStep } from '../src/cli/program/loopNext';
import { addLoopStep, readLoopStatus, renderLoopStatus } from '../src/cli/program/manageLoop';
import { readLoop } from '../src/workflows/development-tooling/loop-state/loopState';

const repoLoops = resolve(import.meta.dirname, '../specification/loops');

/** Every evidence shape and unknown key that stored loops may carry, as authored on disk. */
const stored = {
	name: 'mixed-evidence',
	goal: 'Keep stored evidence readable',
	createdAt: '2026-10-24T14:00:32.887Z',
	updatedAt: '2026-10-24T14:00:32.887Z',
	verificationNotes: 'an unknown top-level key',
	completion: { version: 1, kind: 'coding', reviewer: 'unknown completion key' },
	steps: [
		{ id: 'text', title: 'Text', status: 'complete', evidence: 'bun run check passed' },
		{ id: 'records', title: 'Records', status: 'complete', evidence: [{ note: 'first' }] },
		{ id: 'record', title: 'Record', status: 'complete', evidence: { note: 'only', runs: 2 } },
		{ id: 'texts', title: 'Texts', status: 'complete', evidence: ['one', 'two'] },
		{ id: 'mixed', title: 'Mixed', status: 'complete', evidence: ['one', { note: 'two' }] },
		{ id: 'empty', title: 'Empty', status: 'complete', evidence: [] },
		{ id: 'open', title: 'Open', status: 'pending', owner: 'unknown step key' }
	],
	evaluators: [{ id: 'check', title: 'Check', command: 'true', step: 'open', retries: 3 }]
};

async function seed(root: string, state: unknown, name = 'mixed-evidence'): Promise<string> {
	const dir = join(root, 'specification', 'loops', name);
	await mkdir(dir, { recursive: true });
	const path = join(dir, 'loop.json');
	await writeFile(path, `${JSON.stringify(state, null, '\t')}\n`);
	return path;
}

test('every loop.json stored in this repository reads through readLoop', async () => {
	const names = (await readdir(repoLoops, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const offending: string[] = [];
	let read = 0;
	for (const name of names) {
		try {
			const state = await readLoop(join(repoLoops, name, 'loop.json'));
			read += 1;
			if (state.name !== name) offending.push(`${name}: name is "${state.name}"`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (message !== 'Loop does not exist.') offending.push(`${name}: ${message}`);
		}
	}
	expect(offending).toEqual([]);
	expect(read).toBeGreaterThan(0);
});

test('the stored loop whose evidence is a list of records answers status and next', async () => {
	const root = resolve(repoLoops, '../..');
	const status = await readLoopStatus({ root, loop: 'modules-horizontal-navbar' });
	const text = renderLoopStatus(status);
	expect(text).toContain('Loop: modules-horizontal-navbar');
	expect(text).not.toContain('[object Object]');
	const next = await nextLoopStep({ root, loop: 'modules-horizontal-navbar' });
	expect(next.loop).toBe('modules-horizontal-navbar');
});

test('readLoop keeps every stored evidence shape and unknown key, and writes nothing', () =>
	withTempDir('harness-loop-schema-', async (root) => {
		const path = await seed(root, stored);
		const before = await readFile(path, 'utf8');

		const state = await readLoop(path);

		expect(state).toEqual(stored);
		expect(await readFile(path, 'utf8')).toBe(before);
		const text = renderLoopStatus({ state, tracePath: 'trace' }, stored.updatedAt);
		expect(text).toContain('    evidence: bun run check passed');
		expect(text).toContain('    evidence: {"note":"first"}');
		expect(text).toContain('    evidence: {"note":"only","runs":2}');
		expect(text).toContain('    evidence: one; two');
		expect(text).toContain('    evidence: one; {"note":"two"}');
		expect(text).not.toContain('[object Object]');
		expect(text).toContain('  [complete] empty - Empty\n  [pending] open - Open');
	}));

test('a later write keeps the other steps and unknown keys as they were stored', () =>
	withTempDir('harness-loop-schema-', async (root) => {
		const path = await seed(root, stored);
		const now = '2026-11-14T00:00:00.000Z';

		await addLoopStep({ root, loop: stored.name, step: 'later', title: 'Later', now: () => now });

		expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
			...stored,
			updatedAt: now,
			steps: [...stored.steps, { id: 'later', title: 'Later', status: 'pending' }]
		});
	}));

test('a schema mismatch names the file, each failing field and what was expected', () =>
	withTempDir('harness-loop-schema-', async (root) => {
		const steps = [stored.steps[0], { id: 'bad', title: 'Bad', status: 'complete', evidence: 42 }];
		const path = await seed(root, { ...stored, goal: 7, steps }, 'bad-evidence');

		const error = await readLoop(path).then(
			() => undefined,
			(reason: unknown) => reason
		);

		expect(error).toBeInstanceOf(Error);
		const message = (error as Error).message;
		expect(message.startsWith(`Invalid loop state: ${path}: `)).toBe(true);
		expect(message).toMatch(/goal: [^;]*string/);
		expect(message).toContain(
			'steps[1].evidence: Expected text, an object, or a list of text and objects'
		);
		expect(message).not.toContain('persisted schema mismatch');
		for (const nested of [[42], [null], [['nested']], null])
			await expect(
				readLoop(
					await seed(root, { ...stored, steps: [{ ...steps[1], evidence: nested }] }, 'nest')
				)
			).rejects.toThrow('steps[0].evidence: Expected text');
		await expect(readLoop(await seed(root, [], 'not-an-object'))).rejects.toThrow(
			/not-an-object\/loop\.json: \(root\): /
		);
	}));

test('a mismatch reports at most five fields and loop search still lists the loop', () =>
	withTempDir('harness-loop-schema-', async (root) => {
		const steps = Array.from({ length: 8 }, (_, index) => ({ id: `s${index}`, status: 'pending' }));
		const path = await seed(root, { ...stored, steps }, 'many-issues');

		const message = await readLoop(path).then(
			() => '',
			(reason: Error) => reason.message
		);

		expect(message).toContain('steps[0].title: ');
		expect(message).toContain('steps[4].title: ');
		expect(message).not.toContain('steps[5].title');
		expect(message.endsWith('; and 3 more.')).toBe(true);
		const found = (await searchLoops({ root, query: 'many-issues' })).filter(
			(result) => result.kind === 'loop'
		);
		expect(found).toMatchObject([{ id: 'many-issues', title: 'Invalid persisted loop' }]);
	}));
