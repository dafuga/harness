import { expect } from './verificationExpect';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { attach } from './support/historyRepo';
import { baselineRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';

/**
 * A record is attached only with every record it inherits from intact as stored, however long ago
 * those were attached: a changed test log or capture of a parent or a grandparent refuses it.
 */
const repos: VerifyRepo[] = [];
afterEach(async () => Promise.all(repos.splice(0).map((repo) => repo.dispose())));
const slugify = 'src/utils/slugify.ts';
/** `count` verified commits in a row, each record based on the one before. */
async function chain(count: number): Promise<{ repo: VerifyRepo; records: VerifyOutcome[] }> {
	const repo = await baselineRepo();
	repos.push(repo);
	const records = [await repo.verify()];
	const edits = [
		['toLowerCase', 'toUpperCase'],
		['toUpperCase', 'toLowerCase']
	];
	for (const [from, to] of edits.slice(0, count - 1)) {
		await repo.change(slugify, (source) => source.replace(from, to));
		records.push(await repo.verify());
	}
	return { repo, records };
}
const where = (outcome: VerifyOutcome) => [
	'--commit',
	outcome.record.source.commit,
	'--record',
	outcome.record.id
];
const attachAt = (repo: VerifyRepo, outcome: VerifyOutcome) =>
	repo.run(['history', 'attach', ...where(outcome)]);
const screenshot = (outcome: VerifyOutcome) =>
	outcome.record.scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.find((capture) => capture.kind === 'screenshot')!;

test('a changed test log of an attached parent refuses its child', async () => {
	const { repo, records } = await chain(2);
	const [parent, child] = records;
	await attach(repo, where(parent));
	const log = parent.record.tests[0].log.path;
	await writeFile(join(parent.directory, log), 'changed after the parent was attached');
	const refused = await attachAt(repo, child);
	expect([refused.exitCode, refused.stderr]).toEqual([
		1,
		expect.stringContaining(`evidence ${log} does not match its recorded hash`)
	]);
}, 120_000);

test('a changed test log of an attached grandparent refuses its grandchild', async () => {
	const { repo, records } = await chain(3);
	const [grandparent, parent, child] = records;
	await attach(repo, where(grandparent));
	await attach(repo, where(parent));
	const log = grandparent.record.tests[0].log.path;
	await writeFile(join(grandparent.directory, log), 'changed after the grandparent was attached');
	const refused = await attachAt(repo, child);
	expect([refused.exitCode, refused.stderr]).toEqual([
		1,
		expect.stringContaining(`evidence ${log} does not match its recorded hash`)
	]);
}, 120_000);

test('a changed capture of an attached parent refuses its child', async () => {
	const { repo, records } = await chain(2);
	const [parent, child] = records;
	await attach(repo, where(parent));
	const capture = screenshot(parent);
	await writeFile(join(parent.directory, capture.path), 'not the captured bytes');
	const refused = await attachAt(repo, child);
	expect([refused.exitCode, refused.stderr]).toEqual([
		1,
		expect.stringContaining(`evidence ${capture.path} does not match its recorded hash`)
	]);
}, 120_000);
