import type { Synced, Capture } from './history-sync.e2e.test.types';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import {
	attach,
	evidenceRef,
	freshClone,
	harnessJson,
	lfsObjectPath,
	noteLines,
	notesRef,
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
const sync = (repo: VerifyRepo, action: string) =>
	harnessJson<Synced>(repo, ['history', action, 'origin']);
const media = (record: { scenarios: Array<{ states: Array<{ captures: Capture[] }> }> }) =>
	record.scenarios
		.flatMap((scenario) => scenario.states.flatMap((state) => state.captures))
		.filter((capture) => capture.kind === 'screenshot' || capture.kind === 'audio');
const remoteRef = (repo: VerifyRepo, ref: string) =>
	repo.git(['ls-remote', 'origin', ref]).then((line) => line.split(/\s/)[0]);

test('a fresh clone recovers notes, evidence and media after an explicit sync', async () => {
	const writer = await cloneRepo(baseline);
	const remote = await withRemote(writer);
	const head = await writer.git(['rev-parse', 'HEAD']);
	const { record } = await writer.verify();
	const attached = await attach(writer);
	expect(await sync(writer, 'push')).toEqual({
		remote: 'origin',
		evidence: 'created',
		notes: 'created',
		pushed: true
	});
	expect(await remoteRef(writer, evidenceRef)).toBe(attached.evidence.commit);
	expect(await remoteRef(writer, notesRef)).toBe(await writer.git(['rev-parse', notesRef]));
	expect(await remoteRef(writer, attached.archive)).toBe(head);

	const reader = await freshClone(remote);
	expect(existsSync(join(reader.root, '.cache'))).toBe(false);
	expect((await statusOf(reader)).verified).toBe(false);
	expect(await sync(reader, 'fetch')).toMatchObject({ evidence: 'created', notes: 'created' });
	const status = await statusOf(reader);
	expect([status.verified, status.records.map((item) => item.record)]).toEqual([true, [record.id]]);
	const check = JSON.parse((await reader.run(['verify', 'check', '--json'])).stdout);
	expect(check).toMatchObject({ status: 'passed', record: record.id });
	for (const capture of media(record)) {
		const fetched = await readFile(lfsObjectPath(reader.root, capture.sha256));
		expect(fetched.equals(await readFile(lfsObjectPath(writer.root, capture.sha256)))).toBe(true);
	}

	await rm(join(reader.root, '.git/lfs/objects'), { recursive: true, force: true });
	await rm(join(reader.root, '.cache'), { recursive: true, force: true });
	const gone = await statusOf(reader);
	expect(gone.verified).toBe(false);
	expect(gone.records[0].problems).toContainEqual(
		expect.stringMatching(/media .+ is not available locally; run harness history fetch/)
	);
	expect(await sync(reader, 'fetch')).toMatchObject({ evidence: 'unchanged', notes: 'unchanged' });
	expect((await statusOf(reader)).verified).toBe(true);
	await Promise.all([writer.dispose(), reader.dispose(), removeRemote(remote)]);
}, 300_000);

test('writers that diverge on evidence and notes are merged without losing either', async () => {
	const one = await cloneRepo(baseline);
	const remote = await withRemote(one);
	const two = await cloneRepo(one);
	const head = await one.git(['rev-parse', 'HEAD']);
	const first = await one.verify();
	const second = await two.verify();
	expect(first.record.id).not.toBe(second.record.id);
	const [attachedOne, attachedTwo] = [await attach(one), await attach(two)];
	expect(attachedOne.evidence.commit).not.toBe(attachedTwo.evidence.commit);
	await sync(one, 'push');

	const rejected = await two.run(['history', 'push', 'origin']);
	expect(rejected.exitCode).toBe(1);
	expect(rejected.stderr).toContain('run harness history sync');
	expect(await remoteRef(two, evidenceRef)).toBe(attachedOne.evidence.commit);

	expect(await sync(two, 'sync')).toEqual({
		remote: 'origin',
		evidence: 'merged',
		notes: 'merged',
		pushed: true
	});
	expect(await sync(one, 'sync')).toEqual({
		remote: 'origin',
		evidence: 'fast-forwarded',
		notes: 'fast-forwarded',
		pushed: false
	});
	for (const repo of [one, two]) {
		const tip = await repo.git(['rev-parse', evidenceRef]);
		expect(tip).toBe(await remoteRef(repo, evidenceRef));
		await repo.git(['merge-base', '--is-ancestor', attachedOne.evidence.commit, tip]);
		await repo.git(['merge-base', '--is-ancestor', attachedTwo.evidence.commit, tip]);
		const records = (await noteLines(repo, head))
			.filter((line) => line.kind === 'verification')
			.map((line) => line.record);
		expect(records.sort()).toEqual([first.record.id, second.record.id].sort());
		const status = await statusOf(repo, head);
		expect(status.records.map((item) => item.valid)).toEqual([true, true]);
	}
	expect(await sync(two, 'sync')).toEqual({
		remote: 'origin',
		evidence: 'unchanged',
		notes: 'unchanged',
		pushed: false
	});
	await Promise.all([one.dispose(), two.dispose(), removeRemote(remote)]);
}, 300_000);

test('an interrupted push is completed by running it again', async () => {
	const repo = await cloneRepo(baseline);
	const remote = await withRemote(repo);
	await repo.verify();
	const attached = await attach(repo);
	await repo.git(['push', '-q', 'origin', `${evidenceRef}:${evidenceRef}`]);
	expect(await remoteRef(repo, notesRef)).toBe('');
	expect(await sync(repo, 'push')).toMatchObject({ evidence: 'unchanged', notes: 'created' });
	const reader = await freshClone(remote);
	await sync(reader, 'fetch');
	expect((await statusOf(reader)).verified).toBe(true);
	expect(await remoteRef(repo, attached.archive)).toBe(attached.source);
	await Promise.all([repo.dispose(), reader.dispose(), removeRemote(remote)]);
}, 240_000);
