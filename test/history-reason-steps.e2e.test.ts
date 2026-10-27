import type { Persisted, Told } from './history-reason-steps.e2e.test.types';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { explanationsFile } from '../src/core/explanationTypes';
import { commitLoader } from '../src/workflows/development-tooling/loadRevisions';
import { freshClone, noteLines, removeRemote, withRemote } from './support/historyRepo';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';
import { observedTaskOperation } from './support/taskProfiles';
let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const file = 'src/utils/extra.ts';
const source = (value: number) => `export function extra(): number {\n\treturn ${value};\n}\n`;
const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');
const stale = 'function.extra: the unit was added after its reason was written';
const notes = 'refs/notes/harness';
/** Adds the unit in one commit, with the reason the working tree was given for it. */
async function added(repo: VerifyRepo, explain: () => Promise<unknown>): Promise<string> {
	await repo.write(file, source(1));
	await repo.harness(['units', 'index', '--write']);
	await explain();
	return repo.commit('feat: add extra');
}
/** Changes the unit in another commit; `explained` says whether that step gets a reason. */
async function changed(repo: VerifyRepo, value: number, explained = true): Promise<string> {
	await repo.write(file, source(value));
	await repo.harness(['units', 'index', '--write']);
	if (explained) await repo.explainAll();
	return repo.commit(`feat: return ${value}`);
}
/** What `history reasons` printed for a range, and how it ended. */
async function persist(repo: VerifyRepo, base: string, head: string) {
	const range = ['--commit', head, '--base', base];
	const run = await repo.run(['history', 'reasons', ...range, '--json']);
	return { exitCode: run.exitCode, result: JSON.parse(run.stdout) as Persisted };
}
/** The reasons in the note of a commit, and the same rows as they lie in the scratch file. */
async function kept(repo: VerifyRepo, commit: string) {
	const lines = await noteLines(repo, commit).catch(() => []);
	const noted = lines.filter((line) => line.kind === 'reason');
	const rows = (await readFile(join(repo.root, explanationsFile), 'utf8')).trim().split('\n');
	const written = rows.map((row) => JSON.parse(row) as Told);
	return { noted: noted.map((line) => line.explanation as unknown as Told), written };
}

test('the reasons of every explained step are kept, and a fresh clone with the notes explains the range', async () => {
	const repo = await cloneRepo(baseline);
	const base = await repo.git(['rev-parse', 'HEAD']);
	await added(repo, () => repo.explainAll());
	const head = await changed(repo, 2);
	const range = ['--base', base, '--head', head];
	const check = await repo.run(['explain', 'check', ...range]);
	expect([check.exitCode, check.stdout.trim()]).toEqual([
		0,
		'Every change is explained: 1 reasons.'
	]);

	const persisted = await persist(repo, base, head);
	expect(persisted).toEqual({
		exitCode: 0,
		result: { commit: head, base, attached: 2, missing: [] }
	});
	const { noted, written } = await kept(repo, head);
	const steps = written.filter((row) => row.unit === 'function.extra');
	expect(steps).toHaveLength(2);
	expect(noted).toEqual(expect.arrayContaining(steps));
	expect(noted).toHaveLength(2);
	expect(await persist(repo, base, head)).toEqual(persisted);
	expect((await kept(repo, head)).noted).toHaveLength(2);

	const remote = await withRemote(repo);
	await repo.git(['push', '-q', 'origin', notes]);
	const clone = await freshClone(remote);
	const before = await clone.run(['explain', 'check', ...range]);
	expect(before.exitCode).toBe(1);
	await clone.git(['fetch', '-q', 'origin', `${notes}:${notes}`]);
	const after = await clone.run(['explain', 'check', ...range]);
	expect([after.exitCode, after.stdout.trim()]).toEqual([0, check.stdout.trim()]);
	await Promise.all([repo.dispose(), clone.dispose(), removeRemote(remote)]);
}, 180_000);

test('reason history loaders retain compact facts across a 32-revision walk', async () => {
	const repo = await cloneRepo(baseline);
	const commits = [await added(repo, () => repo.explainAll())];
	for (let revision = 2; revision <= 32; revision++) commits.push(await changed(repo, revision));
	const loader = commitLoader(repo.root);
	const sides = await observedTaskOperation(
		'workflow.load-revisions',
		'reason-history-32-revisions',
		async () => {
			const loaded = [];
			for (const commit of commits) loaded.push(await loader(commit));
			return loaded;
		}
	);

	expect(sides).toHaveLength(32);
	for (const side of sides) {
		expect(Object.keys(side).sort()).toEqual(['index', 'manifests', 'writing']);
		for (const unit of side.manifests) {
			expect(Object.keys(unit).sort()).toEqual(['declarationHash', 'id', 'owns', 'status']);
			expect(Object.keys(unit.owns).sort()).toEqual(['source']);
		}
		for (const file of side.index.files.values()) {
			expect(Object.keys(file).sort()).toEqual(['blocks', 'hash']);
			for (const block of file.blocks) expect(Object.keys(block).sort()).toEqual(['hash', 'name']);
		}
	}
	await repo.dispose();
}, 180_000);

test('a step keeps the writing limits of its own revision when a later one declares limits', async () => {
	const repo = await cloneRepo(baseline);
	const base = await repo.git(['rev-parse', 'HEAD']);
	// A reason from before any limit: the row is as long as rows of that time could be.
	await added(repo, async () => {
		await repo.explainAll();
		const path = join(repo.root, explanationsFile);
		const rows = (await readFile(path, 'utf8')).trimEnd().split('\n');
		const last = JSON.parse(rows.pop() ?? '{}') as Record<string, unknown>;
		rows.push(JSON.stringify({ ...last, behavior: words(40) }));
		await writeFile(path, `${rows.join('\n')}\n`);
	});
	const config = await repo.json<Record<string, unknown>>('harness.verify.json');
	await repo.write('harness.verify.json', JSON.stringify({ ...config, writing: 1 }));
	const head = await changed(repo, 2);
	const check = await repo.run(['explain', 'check', '--base', base, '--head', head]);
	expect(check.exitCode).toBe(0);

	const persisted = await persist(repo, base, head);
	expect(persisted).toEqual({
		exitCode: 0,
		result: { commit: head, base, attached: 2, missing: [] }
	});
	const told40 = (await kept(repo, head)).noted.map((reason) => reason.behavior.split(' ').length);
	expect(told40.sort()).toEqual([2, 40]);
	await repo.dispose();
}, 180_000);

test('a step without a reason keeps the range open: nothing is kept for it and the failure is said', async () => {
	const repo = await cloneRepo(baseline);
	const base = await repo.git(['rev-parse', 'HEAD']);
	await added(repo, () => repo.explainAll());
	await changed(repo, 2, false);
	const head = await changed(repo, 3);
	const check = await repo.run(['explain', 'check', '--base', base, '--head', head]);
	expect(check.exitCode).toBe(1);
	expect(check.stderr).toContain(stale);

	const persisted = await persist(repo, base, head);
	expect(persisted).toEqual({
		exitCode: 1,
		result: { commit: head, base, attached: 0, missing: [stale] }
	});
	expect((await kept(repo, head)).noted).toEqual([]);
	const last = await persist(repo, await repo.git(['rev-parse', 'HEAD~1']), head);
	expect(last.result).toMatchObject({ attached: 1, missing: [] });
	await repo.dispose();
}, 180_000);
