import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	attach,
	evidenceRef,
	freshClone,
	harnessJson,
	lfsObjectPath,
	noteLines,
	removeRemote,
	statusOf,
	withRemote
} from './support/historyRepo';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

const short = (id: string) => id.slice(0, 12);
async function attached() {
	const repo = await cloneRepo(baseline);
	const { record } = await repo.verify();
	return { repo, record, attached: await attach(repo) };
}
const setNote = (repo: VerifyRepo, text: string) =>
	repo.git(['notes', '--ref=harness', 'add', '-f', '-m', text, 'HEAD']);

test('a malformed note line is reported and the valid lines beside it still count', async () => {
	const { repo, record } = await attached();
	await repo.git([
		'notes',
		'--ref=harness',
		'append',
		'-m',
		'{"kind":"verification","record":',
		'HEAD'
	]);
	const status = await statusOf(repo);
	expect(status.problems).toContainEqual(
		expect.stringMatching(/^note line \d+ is not a valid history entry$/)
	);
	expect([status.verified, status.records.map((item) => item.record)]).toEqual([true, [record.id]]);
	await repo.dispose();
}, 180_000);

test('missing evidence, a changed manifest and tampered media are never trusted', async () => {
	const missing = await attached();
	const lines = await noteLines(missing.repo);
	const verification = lines.find((line) => line.kind === 'verification');
	const absent = {
		...verification,
		evidence: { ...verification?.evidence, commit: '0'.repeat(40) }
	};
	await setNote(missing.repo, JSON.stringify(absent));
	const gone = await statusOf(missing.repo);
	expect(gone.verified).toBe(false);
	expect(gone.records[0].problems).toEqual([
		`evidence commit ${'0'.repeat(12)} is not available; run harness history fetch`
	]);
	const other = {
		...verification,
		evidence: { ...verification?.evidence, manifest: 'f'.repeat(64) }
	};
	await setNote(missing.repo, JSON.stringify(other));
	const changed = await statusOf(missing.repo);
	expect([changed.verified, changed.records[0].problems]).toEqual([
		false,
		['manifest does not match the hash in the note']
	]);
	await missing.repo.dispose();

	const tampered = await attached();
	const image = tampered.record.scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.find((capture) => capture.kind === 'screenshot');
	await writeFile(lfsObjectPath(tampered.repo.root, image?.sha256 ?? ''), 'other bytes');
	const status = await statusOf(tampered.repo);
	expect(status.verified).toBe(false);
	expect(status.records[0].problems).toContain(
		`media ${image?.path} does not match its recorded hash`
	);
	await rm(join(tampered.repo.root, '.cache/harness/verifications'), { recursive: true });
	const check = await tampered.repo.run(['verify', 'check']);
	expect(check.exitCode).toBe(1);
	const build = await tampered.repo.run([
		'history',
		'build',
		'--out',
		'.cache/history',
		'--strict'
	]);
	expect(build.exitCode).toBe(1);
	expect(build.stderr).toContain(`media ${image?.path} does not match its recorded hash`);
	await tampered.repo.dispose();
}, 300_000);

test('inherited evidence is validated through to the record that produced it', async () => {
	const repo = await cloneRepo(baseline);
	const remote = await withRemote(repo);
	const parent = await repo.verify();
	await repo.change('src/utils/slugify.ts', (source) =>
		source.replace('toLowerCase', 'toUpperCase')
	);
	await repo.git(['push', '-q', 'origin', 'main']);
	const child = await repo.verify();
	expect(child.record.status).toBe('passed');
	const clock = child.record.scenarios.find((scenario) => scenario.id === 'clock');
	expect(clock).toMatchObject({ status: 'referenced', referencedRecord: parent.record.id });
	expect(child.record.source).toMatchObject({ baseRecord: parent.record.id });

	// Attaching a record attaches what it depends on, so the lineage is complete in Git.
	await attach(repo, ['--record', child.record.id]);
	const parentLines = (await noteLines(repo, 'HEAD~1')).filter(
		(line) => line.kind === 'verification'
	);
	expect(parentLines.map((line) => line.record)).toEqual([parent.record.id]);
	expect((await statusOf(repo)).verified).toBe(true);

	await repo.git(['notes', '--ref=harness', 'remove', 'HEAD~1']);
	const alone = await statusOf(repo);
	expect(alone.verified).toBe(false);
	expect(alone.records[0].problems).toEqual(
		expect.arrayContaining([
			`base record ${short(parent.record.id)} is not available`,
			`scenario clock is inherited from record ${short(parent.record.id)}, which is not available`
		])
	);
	await attach(repo, ['--commit', 'HEAD~1', '--record', parent.record.id]);
	expect((await statusOf(repo)).verified).toBe(true);
	await harnessJson(repo, ['history', 'push', 'origin']);
	const reader = await freshClone(remote);
	await harnessJson(reader, ['history', 'fetch', 'origin']);
	const restored = await statusOf(reader);
	expect([restored.verified, restored.records[0].problems]).toEqual([true, []]);
	expect(await reader.git(['rev-parse', evidenceRef])).toBe(
		await repo.git(['rev-parse', evidenceRef])
	);
	await Promise.all([repo.dispose(), reader.dispose(), removeRemote(remote)]);
}, 300_000);
