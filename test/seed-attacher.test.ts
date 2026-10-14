import { expect } from './verificationExpect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, test } from 'vitest';
import { SeedAttacher } from '../packages/reports/scripts/harness-seed-attacher';
import { VerificationStoreRepository } from '../src/repositories/VerificationStoreRepository';
import { noteLine } from '../src/utils/noteLines';
import { attach, evidenceRef, noteLines, notesRef } from './support/historyRepo';
import { baselineRepo, cloneRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';

/**
 * The console seed attaches its records through one attacher of its own repository. It leaves in
 * Git what `harness history attach` leaves for the same records in the same order, and attaches
 * nothing of another repository, of a second attacher, once closed, or after a record changed.
 */
const repos: VerifyRepo[] = [];
const records: VerifyOutcome[] = [];
let source: VerifyRepo;
beforeAll(async () => {
	source = await baselineRepo();
	repos.push(source);
	records.push(await source.verify());
	await source.change('src/utils/slugify.ts', (text) => text.replace('toLowerCase', 'toUpperCase'));
	records.push(await source.verify());
	records.push(await source.verify([], { FIXTURE_SKIP: 'filled-mobile' }));
}, 240_000);
afterAll(async () => Promise.all(repos.splice(0).map((repo) => repo.dispose())));
async function copy(): Promise<VerifyRepo> {
	const repo = await cloneRepo(source);
	repos.push(repo);
	return repo;
}
const at = (outcome: VerifyOutcome) => ({
	commit: outcome.record.source.commit,
	record: outcome.record.id
});
const where = (outcome: VerifyOutcome) => [
	'--commit',
	outcome.record.source.commit,
	'--record',
	outcome.record.id
];
const lines = async (repo: VerifyRepo, args: string[]) =>
	(await repo.git(args)).split('\n').filter(Boolean);
/**
 * Evidence commits, notes and refs of a repository. An evidence commit's id holds the time it was
 * made, so its tree and subject stand for it, and in a note it is replaced by that tree.
 */
async function history(repo: VerifyRepo) {
	const evidence = await lines(repo, ['log', '--format=%T %s', evidenceRef]);
	const notes = [];
	for (const commit of (await lines(repo, ['notes', `--ref=${notesRef}`, 'list'])).map(
		(line) => line.split(' ')[1]
	)) {
		const tree = async (id: string) => repo.git(['rev-parse', `${id}^{tree}`]);
		const shown = await noteLines(repo, commit);
		for (const line of shown)
			if (line.evidence) line.evidence.commit = await tree(line.evidence.commit);
		// Evidence commit hashes carry time. Re-sort the full entries after replacing them.
		notes.push({
			commit,
			lines: shown.sort((left, right) => noteLine(left).localeCompare(noteLine(right)))
		});
	}
	const refs = await lines(repo, ['for-each-ref', '--format=%(refname) %(objectname)']);
	const kept = refs.filter(
		(ref) => !ref.startsWith(`${notesRef} `) && !ref.startsWith(evidenceRef)
	);
	return { evidence, notes, refs: kept };
}

test('records attached through one seed attacher leave the history the CLI leaves', async () => {
	const [cli, seed] = [await copy(), await copy()];
	for (const outcome of records) await attach(cli, where(outcome));
	const attacher = await SeedAttacher.open(seed.root);
	const attached = [];
	for (const outcome of records) attached.push(await attacher.attach(seed.root, at(outcome)));
	await attacher.close();
	expect(attached.map((item) => [item.record, item.status, item.created])).toEqual(
		records.map((outcome) => [outcome.record.id, outcome.record.status, true])
	);
	expect(attached.map((item) => item.status)).toContain('failed');
	const [expected, actual] = [await history(cli), await history(seed)];
	expect(actual.evidence.length).toBeGreaterThanOrEqual(records.length);
	expect(actual).toEqual(expected);
}, 240_000);

test('a seed attacher refuses another repository, a second attacher, a changed record and use once closed', async () => {
	const [own, other] = [await copy(), await copy()];
	const attacher = await SeedAttacher.open(own.root);
	await expect(SeedAttacher.open(own.root)).rejects.toThrow('already had a seed attacher');
	await expect(attacher.attach(other.root, at(records[0]))).rejects.toThrow(
		'is not the repository of this seed attacher'
	);
	await expect(attacher.attach(own.root, { record: 'missing' })).rejects.toThrow(
		'missing is not a verification record.'
	);
	const misplaced = { commit: records[0].record.source.commit, record: records[1].record.id };
	await expect(attacher.attach(own.root, misplaced)).rejects.toThrow(
		`Record ${records[1].record.id} is of ${records[1].record.source.commit}`
	);
	await attacher.attach(own.root, at(records[0]));
	const log = records[0].record.tests[0].log.path;
	const { directory } = new VerificationStoreRepository(own.root).load(records[0].record.id)!;
	await writeFile(join(directory, log), 'changed after the seed attached it');
	const changed = `Record ${records[0].record.id} changed or went away during this seed.`;
	await expect(attacher.attach(own.root, at(records[1]))).rejects.toThrow(changed);
	await expect(attacher.close()).rejects.toThrow(changed);
	const closed = await SeedAttacher.open(other.root);
	await closed.close();
	await expect(closed.attach(other.root, at(records[0]))).rejects.toThrow(
		'This seed attacher is closed.'
	);
}, 240_000);
