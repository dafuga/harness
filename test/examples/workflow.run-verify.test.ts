import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'vitest';
import * as runVerify from '../../src/workflows/verification-evidence/run-verify/runVerify';
import type { VerifyResult } from '../../src/workflows/verification-evidence/run-verify/runVerify.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import type { TemporaryRepo } from '../support/temporary.types';
import { expect } from '../verificationExpect';

const unitId = 'workflow.run-verify';
const evidence = 'examples-cases';
const entity = 'example.component.grid';
const emptySlot = `harness-build:${'0'.repeat(64)}`;
const sourceFailures = [
	'entry.app: the unit was added without a reason',
	'entry.app: no baseline is established; a reviewer must establish one'
];

function write(directory: string, path: string, text: string): void {
	mkdirSync(join(directory, dirname(path)), { recursive: true });
	writeFileSync(join(directory, path), text);
}

/** Three commits: documentation, a source unit with no reason, then documentation on top of it. */
function history(repo: TemporaryRepo): string[] {
	const files: Array<[string, string]> = [
		['README.md', 'Docs.\n'],
		['src/app.ts', 'export const version = 1;\n'],
		['README.md', 'Docs again.\n']
	];
	return files.map(([path, text]) => {
		write(repo.root, path, text);
		repo.git('add', '--', path);
		repo.git('-c', 'commit.gpgsign=false', 'commit', '-qm', `Update ${path}`);
		return repo.git('rev-parse', 'HEAD');
	});
}

/** Verifies a root at one revision with the module kernel, which does not depend on machine measurements. */
function verifyAt(root: string, commit?: string): Promise<VerifyResult> {
	return runVerify.verifyRun({ root, commit, runtime: 'module' });
}

/** The name and message of the refusal an operation raised; fails when the operation resolved instead. */
function refusal(operation: () => Promise<unknown>) {
	return operation().then(
		() => Promise.reject(new Error('Expected a refusal.')),
		(error: Error) => ({ name: error.name, message: error.message })
	);
}

/** Labels what differs between runs: temporary directories, revisions, then the parts of stored results. */
function scrubber(directories: string[], revisions: string[] = [], results: VerifyResult[] = []) {
	const labels = [
		...directories.map((directory) => [directory, '<temporary directory>'] as const),
		...revisions.map((revision, index) => [revision, `<revision ${index + 1}>`] as const),
		...results.flatMap(({ directory, record }, index) => {
			const name = `result ${index + 1}`;
			return [
				[directory, `<${name} directory>`] as const,
				[record.id, `<${name} record id>`] as const,
				[record.id.slice(0, 12), `<${name} record prefix>`] as const
			];
		})
	].sort(([left], [right]) => right.length - left.length);
	const replace = (text: string, [part, label]: readonly [string, string]) =>
		text.split(part).join(label);
	return (value: unknown): unknown => JSON.parse(labels.reduce(replace, JSON.stringify(value)));
}

/** The fields of a stored result that the examples read. */
function summary({ record, attachment }: VerifyResult) {
	const { status, source, failures } = record;
	return { status, ...source, failures, attachment: attachment ?? null };
}

test('Stamps each build slot with the identity it keeps unchanged', async () => {
	await withTempDir('run-verify-stamp-', async (root) => {
		const state = 'stamps-each-build-slot-with-the-identity-it-keeps-unchanged';
		const build = join(root, 'worker');
		const plain = join(root, 'plain');
		const empty = join(root, 'empty');
		write(build, 'worker.js', `export const build = '${emptySlot}';\n`);
		write(build, 'lib/util.js', 'export const value = 1;\n');
		write(plain, 'app.js', 'export const value = 2;\n');
		mkdirSync(empty);
		const before = await runVerify.verifyIdentity(build);
		const stamped = await runVerify.verifyStamp(build);
		const after = await runVerify.verifyIdentity(build);
		const written = readFileSync(join(build, 'worker.js'), 'utf8');
		const noSlot = await refusal(() => runVerify.verifyStamp(plain));
		const noFiles = await refusal(() => runVerify.verifyStamp(empty));
		const noIdentity = await refusal(() => runVerify.verifyIdentity(empty));
		write(build, 'lib/util.js', 'export const value = 3;\n');
		const edited = await runVerify.verifyIdentity(build);
		const scrub = scrubber([root]);
		expect(before).toEqual({ directory: build, buildId: before.buildId, files: 2 });
		expect(stamped).toEqual({ ...before, stamp: before.buildId });
		expect(after).toEqual(stamped);
		expect(written).toBe(`export const build = 'harness-build:${before.buildId}';\n`);
		expect(edited.buildId).not.toBe(before.buildId);
		expect(noSlot.message).toBe(
			`${plain} has no stamp slot: nothing in it reports a build identity.`
		);
		expect(noFiles.message).toBe(
			`${empty} has no stamp slot: nothing in it reports a build identity.`
		);
		expect(noIdentity.message).toBe(`${empty} holds no built files.`);
		recordExampleCases({ unitId, symbol: 'verifyStamp', state, evidence, file: `${state}.json` }, [
			{ name: 'an empty stamp slot in a worker file', input: scrub(build), output: scrub(stamped) },
			{ name: 'a directory whose files hold no slot', input: scrub(plain), error: scrub(noSlot) },
			{ name: 'the build read back after stamping', input: scrub(build), output: scrub(after) },
			{ name: 'an empty directory', input: scrub(empty), error: scrub(noFiles) }
		]);
	});
}, 20000);

test('Verifies each revision against its nearest passing ancestor', async () => {
	await withTempDir('run-verify-plain-', async (plain) => {
		await withTempRepo(async (repo) => {
			const state = 'verifies-each-revision-against-its-nearest-passing-ancestor';
			const [first, second] = history(repo);
			const passed = await verifyAt(repo.root, first);
			const failed = await verifyAt(repo.root, second);
			const notRepository = await refusal(() => verifyAt(plain));
			const unknown = await refusal(() => verifyAt(repo.root, 'missing-revision'));
			const scrub = scrubber([plain, repo.root], [first, second], [passed]);
			const run = (root: string, commit?: string) => scrub({ root, commit, runtime: 'module' });
			const show = (result: VerifyResult) => scrub(summary(result));
			expect(passed.record).toMatchObject({ status: 'passed', failures: [] });
			expect(passed.record.source.base).toBeNull();
			expect(failed.record).toMatchObject({ status: 'failed', failures: sourceFailures });
			expect(failed.record.source.base).toBe(first);
			expect(failed.record.source.baseRecord).toBe(passed.record.id);
			expect(notRepository.message).toBe('harness verify needs a Git repository.');
			expect(unknown.message).toBe('"missing-revision" does not name a commit in this repository.');
			recordExampleCases({ unitId, symbol: 'verifyRun', state, evidence, file: `${state}.json` }, [
				{ name: 'the first revision', input: run(repo.root, first), output: show(passed) },
				{ name: 'the second revision', input: run(repo.root, second), output: show(failed) },
				{ name: 'a directory, not a repository', input: run(plain), error: scrub(notRepository) },
				{
					name: 'a revision that is not a commit',
					input: run(repo.root, 'missing-revision'),
					error: scrub(unknown)
				}
			]);
		});
	});
}, 20000);

test('Renders a stored verification as its summary lines', async () => {
	await withTempRepo(async (repo) => {
		const state = 'renders-a-stored-verification-as-its-summary-lines';
		const [first, second, third] = history(repo);
		const passed = await verifyAt(repo.root, first);
		const failed = await verifyAt(repo.root, second);
		const widened = await verifyAt(repo.root, third);
		const attached: VerifyResult = {
			...passed,
			attachment: {
				status: 'attached',
				entity,
				record: passed.record.id,
				states: ['populated'],
				viewports: ['desktop']
			}
		};
		const failedText = runVerify.renderVerify(failed);
		const widenedText = runVerify.renderVerify(widened);
		const attachedText = runVerify.renderVerify(attached);
		const scrub = scrubber([repo.root], [first, second, third], [passed, failed, widened]);
		const show = (result: VerifyResult) => scrub(summary(result));
		expect(failedText).toBe(
			`Verification failed for ${second}.\nTests: 0 run. Scenarios: 0 verified, 0 referenced.\n  ${sourceFailures[0]}\n  ${sourceFailures[1]}\nRecord ${failed.record.id.slice(0, 12)} in ${failed.directory}`
		);
		expect(widenedText).toContain(
			`Compared with ${first}: ${second} has no passing record, so everything since the last verified revision was checked.`
		);
		expect(attachedText).toContain(
			`\nScreenshots attached for ${entity}: states populated; viewports desktop; record ${passed.record.id}.`
		);
		recordExampleCases({ unitId, symbol: 'renderVerify', state, evidence, file: `${state}.json` }, [
			{ name: 'a failed second revision', input: show(failed), output: scrub(failedText) },
			{ name: 'a widened third revision', input: show(widened), output: scrub(widenedText) },
			{ name: 'an attached first revision', input: show(attached), output: scrub(attachedText) }
		]);
	});
}, 20000);

test('Checks the stored record of a commit and lists its problems', async () => {
	await withTempRepo(async (repo) => {
		const state = 'checks-the-stored-record-of-a-commit-and-lists-its-problems';
		const [first, second, third] = history(repo);
		const passed = await verifyAt(repo.root, first);
		const failed = await verifyAt(repo.root, second);
		const recordPath = join(failed.directory, 'record.json');
		const check = (commit: string, record?: string) =>
			runVerify.verifyCheck({ root: repo.root, commit, record });
		const passedCheck = await check(first);
		const failedCheck = await check(second, recordPath);
		const unrecorded = await refusal(() => check(third));
		const scrub = scrubber([repo.root], [first, second, third], [passed, failed]);
		const at = (commit: string) => scrub({ root: repo.root, commit });
		const byPath = scrub({ root: repo.root, commit: second, record: recordPath });
		expect(passedCheck).toMatchObject({ status: 'passed', commit: first, problems: [] });
		expect(failedCheck.status).toBe('failed');
		expect(failedCheck.record).toBe(failed.record.id);
		expect(failedCheck.problems).toEqual(sourceFailures);
		expect(unrecorded.message).toBe(
			`No verification record exists for ${third}; run harness verify run.`
		);
		recordExampleCases({ unitId, symbol: 'verifyCheck', state, evidence, file: `${state}.json` }, [
			{ name: 'the first revision, latest record', input: at(first), output: scrub(passedCheck) },
			{ name: 'the second revision, record by path', input: byPath, output: scrub(failedCheck) },
			{ name: 'the third revision, unrecorded', input: at(third), error: scrub(unrecorded) }
		]);
	});
}, 20000);
