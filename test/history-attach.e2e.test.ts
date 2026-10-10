import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	attach,
	evidenceRef,
	lfsObjectPath,
	noteLines,
	sha256,
	statusOf,
	type Attached,
	type NoteLine
} from './support/historyRepo';
import { baselineRepo, cloneRepo, type VerifyOutcome, type VerifyRepo } from './support/verifyRepo';

let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo();
}, 120_000);
afterAll(() => baseline.dispose());

interface Manifest {
	record: string;
	source: { commit: string; tree: string };
	status: string;
	files: Array<{ path: string; sha256: string; bytes: number; storage: string }>;
}
const grow = (source: string) =>
	source.replace(
		'\treturn input',
		"\tif (input.length > 99 || input.includes('?')) return input;\n\treturn input"
	);
const show = (repo: VerifyRepo, object: string) => repo.git(['show', object]);

type TestedRecord = VerifyOutcome['record'];
interface Stored {
	repo: VerifyRepo;
	record: TestedRecord;
	attached: Attached;
	head: string;
	tree: string;
}
const capturesOf = (record: TestedRecord) =>
	record.scenarios.flatMap((scenario) => scenario.states.flatMap((state) => state.captures));

/** The manifest and the record on the evidence branch are the ones that were attached. */
async function expectManifest(stored: Stored): Promise<Manifest> {
	const { repo, record, attached, head, tree } = stored;
	const { path } = attached.evidence;
	const listed = (await repo.git(['ls-tree', '-r', '--name-only', evidenceRef])).split('\n');
	expect(listed).toEqual(expect.arrayContaining(['.gitattributes', 'harness-evidence.json']));
	const manifestText = await show(repo, `${evidenceRef}:${path}/manifest.json`);
	expect(sha256(`${manifestText}\n`)).toBe(attached.evidence.manifest);
	const manifest = JSON.parse(manifestText) as Manifest;
	expect(manifest).toMatchObject({
		record: record.id,
		source: { commit: head, tree },
		status: 'passed'
	});
	expect(JSON.parse(await show(repo, `${evidenceRef}:${path}/record.json`))).toEqual(record);
	return manifest;
}

/** Media is a pointer on the branch and the original bytes in the LFS store; text is a blob. */
async function expectFiles(stored: Stored, manifest: Manifest, directory: string): Promise<void> {
	const { repo, record, attached } = stored;
	const captures = capturesOf(record);
	const media = captures.filter((capture) => ['screenshot', 'audio'].includes(capture.kind));
	const kinds = new Set(media.map((capture) => capture.kind));
	expect([...kinds].sort()).toEqual(['audio', 'screenshot']);
	for (const item of [
		media.find((capture) => capture.kind === 'screenshot'),
		media.find((capture) => capture.kind === 'audio')
	]) {
		if (!item) throw new Error('the fixture produced no media');
		const { path, sha256: hash, bytes, mediaType } = item;
		const entry = manifest.files.find((file) => file.path === path);
		expect(entry).toEqual({ path, sha256: hash, bytes, storage: 'lfs', mediaType });
		expect(await show(repo, `${evidenceRef}:${attached.evidence.path}/${path}`)).toBe(
			`version https://git-lfs.github.com/spec/v1\noid sha256:${hash}\nsize ${bytes}`
		);
		const original = await readFile(lfsObjectPath(repo.root, hash));
		expect(original.equals(await readFile(join(directory, path)))).toBe(true);
	}
	const output = captures.find((capture) => capture.kind === 'benchmark');
	expect(manifest.files.find((file) => file.path === output?.path)).toMatchObject({
		storage: 'git',
		sha256: output?.sha256
	});
	expect(manifest.files.map((file) => file.path)).toEqual(
		expect.arrayContaining(['record.json', ...record.tests.map((item) => item.log.path)])
	);
}

/** The note names the record, its source and its evidence, and carries the reasons. */
async function expectNote(stored: Stored): Promise<NoteLine[]> {
	const { repo, record, attached, head, tree } = stored;
	const lines = await noteLines(repo);
	expect(lines.filter((line) => line.kind === 'verification')).toEqual([
		{
			schemaVersion: 1,
			kind: 'verification',
			record: record.id,
			status: 'passed',
			profile: record.profile.id,
			finishedAt: record.finishedAt,
			source: { commit: head, tree, base: record.source.base },
			evidence: attached.evidence
		}
	]);
	const reasons = lines.filter((line) => line.kind === 'reason');
	expect(reasons.map((line) => line.explanation?.unit).sort()).toEqual(
		(record.reasons.entries ?? []).map((entry) => entry.unit).sort()
	);
	expect(reasons.length).toBeGreaterThan(0);
	return lines;
}

test('a passing record is stored immutably in Git without changing the source commit', async () => {
	const repo = await cloneRepo(baseline);
	const head = await repo.git(['rev-parse', 'HEAD']);
	const tree = await repo.git(['rev-parse', 'HEAD^{tree}']);
	const { record, directory } = await repo.verify();
	const attached = await attach(repo);
	const path = `records/${head}/${record.id}`;
	expect(attached).toEqual({
		record: record.id,
		status: 'passed',
		source: head,
		evidence: {
			commit: await repo.git(['rev-parse', evidenceRef]),
			path,
			manifest: expect.any(String)
		},
		note: 'refs/notes/harness',
		archive: `refs/harness/source/${head}`,
		created: true
	});
	expect(await repo.git(['rev-parse', 'HEAD', 'main', 'HEAD^{tree}'])).toBe(
		`${head}\n${head}\n${tree}`
	);
	expect(await repo.git(['status', '--porcelain'])).toBe('');
	expect(await repo.git(['rev-parse', attached.archive])).toBe(head);

	const stored = { repo, record, attached, head, tree };
	await expectFiles(stored, await expectManifest(stored), directory);
	const lines = await expectNote(stored);
	const again = await attach(repo);
	expect(again).toEqual({ ...attached, created: false });
	expect(await repo.git(['rev-parse', evidenceRef])).toBe(attached.evidence.commit);
	expect(await noteLines(repo)).toEqual(lines);
	await repo.dispose();
}, 180_000);

test('a failed record stays failed, and a tampered record or capture is refused', async () => {
	const repo = await cloneRepo(baseline);
	await repo.change('src/utils/slugify.ts', grow);
	const failed = await repo.verify();
	expect(failed.exitCode).toBe(1);
	const attached = await attach(repo);
	expect([attached.status, attached.created]).toEqual(['failed', true]);
	const status = await statusOf(repo);
	expect([
		status.verified,
		status.records.map((item) => [item.record, item.status, item.valid])
	]).toEqual([false, [[failed.record.id, 'failed', true]]]);
	const verifications = (await noteLines(repo)).filter((line) => line.kind === 'verification');
	expect(verifications.map((line) => line.status)).toEqual(['failed']);

	const other = await cloneRepo(baseline);
	const passing = await other.verify();
	const recordFile = join(passing.directory, 'record.json');
	const original = await readFile(recordFile, 'utf8');
	await writeFile(recordFile, original.replace(/"durationMs": \d+/, '"durationMs": 1'));
	const forged = await other.run(['history', 'attach']);
	expect(forged.exitCode).toBe(1);
	expect(forged.stderr).toContain('cannot be attached: record content does not match its id');
	await writeFile(recordFile, original);
	const capture = passing.record.scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.find((item) => item.kind === 'screenshot');
	await writeFile(join(passing.directory, capture?.path ?? ''), 'not the captured bytes');
	const swapped = await other.run(['history', 'attach']);
	expect(swapped.exitCode).toBe(1);
	expect(swapped.stderr).toContain(`evidence ${capture?.path} does not match its recorded hash`);
	await expect(other.git(['rev-parse', '--verify', '--quiet', evidenceRef])).rejects.toThrow();
	expect(await other.git(['notes', '--ref=harness', 'list'])).toBe('');
	await Promise.all([repo.dispose(), other.dispose()]);
}, 240_000);

test('separate runs of one commit are both kept and earlier evidence never changes', async () => {
	const repo = await cloneRepo(baseline);
	const first = await repo.verify();
	const one = await attach(repo, ['--record', first.record.id]);
	const before = await repo.git(['ls-tree', '-r', one.evidence.commit]);
	const second = await repo.verify();
	expect(second.record.id).not.toBe(first.record.id);
	const two = await attach(repo, ['--record', second.record.id]);
	expect(two.created).toBe(true);
	await repo.git(['merge-base', '--is-ancestor', one.evidence.commit, two.evidence.commit]);
	const after = await repo.git(['ls-tree', '-r', two.evidence.commit]);
	for (const line of before.split('\n')) expect(after).toContain(line);
	const kept = (await noteLines(repo)).filter((line) => line.kind === 'verification');
	expect(kept.map((line) => line.record).sort()).toEqual(
		[first.record.id, second.record.id].sort()
	);
	const status = await statusOf(repo);
	expect(status.verified).toBe(true);
	expect(status.records).toHaveLength(2);
	await repo.dispose();
}, 180_000);
