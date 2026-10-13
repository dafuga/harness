import { expect, test } from 'vitest';
import { evidenceFixture, sourceAt, type EvidenceFixture } from '../support/evidenceFixture';
import { attachedAt } from '../support/evidenceReaders';

const shot = 'captures/titles-default-desktop.png';
async function opened(f: EvidenceFixture, within: string | null = f.pins.evidenceRevision) {
	return attachedAt(f, await sourceAt(f, f.commits.changed), within);
}

test('a stored record retains attested file facts and reads selected bytes on demand', async () => {
	const f = evidenceFixture();
	const attached = await opened(f);
	const loaded = await attached.load(f.pointers.second);
	const { record, files } = f.records.second;
	expect(loaded.problems).toEqual([]);
	expect(loaded.record).toEqual(record);
	expect(loaded.manifest).toMatchObject({ record: record.id, status: 'passed' });
	expect(loaded.manifest?.files.find((file) => file.path === shot)?.storage).toBe('lfs');
	// Full validation keeps facts for all files, not resident copies of every media object.
	expect([...loaded.files.keys()]).toEqual(['record.json']);
	expect([...loaded.facts.keys()].sort()).toEqual(['record.json', ...files.keys()].sort());
	expect(loaded.facts.get(shot)).toMatchObject({
		sha256: record.scenarios[0].states[0].captures[0].sha256,
		bytes: files.get(shot)?.length
	});
	expect(await attached.readFile(f.pointers.second, shot)).toEqual(files.get(shot));
	expect(attached.load({ ...f.pointers.second })).toBe(attached.load(f.pointers.second));
});

test('a pointer is followed only into the evidence that is pinned', async () => {
	const f = evidenceFixture();
	const stray = `evidence commit ${f.pointers.second.commit.slice(0, 12)} is not part of the pinned evidence`;
	for (const within of [null, f.pointers.first.commit]) {
		const loaded = await (await opened(f, within)).load(f.pointers.second);
		expect(loaded.problems).toEqual([stray]);
		expect([loaded.record, loaded.manifest, loaded.files.size]).toEqual([undefined, undefined, 0]);
	}
	const exact = await (await opened(f, f.pointers.second.commit)).load(f.pointers.second);
	expect(exact.problems).toEqual([]);
});

test('what the branch holds is compared with the note and with the manifest, file by file', async () => {
	const f = evidenceFixture();
	const { commit, path } = f.pointers.second;
	const held = f.git.commits.get(commit)?.files as Map<string, Uint8Array>;
	const log = 'logs/titles-page-renders.log';
	held.delete(`${path}/${log}`);
	const loaded = await (await opened(f)).load(f.pointers.second);
	expect(loaded.problems).toEqual([`${log} is missing from the evidence branch`]);
	expect(loaded.record?.id).toBe(f.records.second.record.id);
	const renamed = { ...f.pointers.second, manifest: 'a'.repeat(64) };
	expect((await (await opened(f)).load(renamed)).problems).toEqual([
		'manifest does not match the hash in the note'
	]);
	const absent = { ...f.pointers.second, path: 'records/none' };
	expect((await (await opened(f)).load(absent)).problems).toEqual([
		'manifest does not match the hash in the note'
	]);
});

test('a directory whose record is not a sealed record is said to hold none', async () => {
	const f = evidenceFixture();
	const { commit, path } = f.pointers.first;
	const held = f.git.commits.get(commit)?.files as Map<string, Uint8Array>;
	held.set(`${path}/record.json`, new TextEncoder().encode('{"id":"x"}'));
	const loaded = await (await opened(f)).load(f.pointers.first);
	expect(loaded.record).toBeUndefined();
	expect(loaded.problems).toEqual([
		'record.json does not match its manifest',
		'record.json is not a record'
	]);
});
