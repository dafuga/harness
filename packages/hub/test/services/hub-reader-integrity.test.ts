import type { EvidenceManifest } from '../../../../src/core/historyTypes';
import { sealRecord } from '../../../../src/utils/sealRecord';
import { asked, read } from '../support/evidenceFixture';
import { expect, test } from 'vitest';
import { evidenceFixture, sourceAt } from '../support/evidenceFixture';
import { attachedAt } from '../support/evidenceReaders';
import { json, sha256, stored, verification } from '../support/evidenceRecords';

async function changedManifest(
	change: (manifest: EvidenceManifest, held: Map<string, Uint8Array>, path: string) => void
) {
	const f = evidenceFixture();
	const pointer = { ...f.pointers.first };
	const held = f.git.commits.get(pointer.commit)!.files;
	const manifest = JSON.parse(new TextDecoder().decode(held.get(`${pointer.path}/manifest.json`)!));
	change(manifest, held, pointer.path);
	const bytes = json(manifest);
	held.set(`${pointer.path}/manifest.json`, bytes);
	pointer.manifest = sha256(bytes);
	const reader = attachedAt(f, await sourceAt(f, f.commits.root), f.pins.evidenceRevision);
	return reader.load(pointer);
}

test('matching manifest hash cannot bless an unsealed original record', async () => {
	const loaded = await changedManifest((manifest, held, path) => {
		const record = JSON.parse(new TextDecoder().decode(held.get(`${path}/record.json`)!));
		record.failures.push('silently changed');
		const bytes = json(record);
		held.set(`${path}/record.json`, bytes);
		Object.assign(manifest.files.find((f) => f.path === 'record.json')!, {
			sha256: sha256(bytes),
			bytes: bytes.length
		});
	});
	expect(loaded.problems).toContain('record content does not match its id');
});

test('manifest identity must agree with the sealed original', async () => {
	const loaded = await changedManifest((manifest) => {
		manifest.source.tree = 'a'.repeat(40);
	});
	expect(loaded.problems).toContain('manifest identity differs from the record');
});

test('every declared file size is checked as well as every hash', async () => {
	const loaded = await changedManifest((manifest) => {
		manifest.files[0].bytes++;
	});
	expect(loaded.problems).toContain('record.json does not match its manifest');
});

test.each(['duplicate', 'traversal'])(
	'manifest rejects %s paths before reading records',
	async (mode) => {
		const loaded = await changedManifest((manifest) => {
			if (mode === 'duplicate') manifest.files.push({ ...manifest.files[0] });
			else manifest.files[0].path = '../record.json';
		});
		expect(loaded.problems).toEqual(['manifest file paths are not valid']);
		expect(loaded.record).toBeUndefined();
	}
);

test('wrong media bytes are explicitly refused before caching', async () => {
	const f = evidenceFixture();
	const capture = f.records.first.record.scenarios[0].states[0].captures[0];
	f.git.lfs.set(capture.sha256, new Uint8Array(capture.bytes));
	const pending = attachedAt(f, await sourceAt(f, f.commits.root), f.pins.evidenceRevision).load(
		f.pointers.first
	);
	await expect(pending).rejects.toMatchObject({ code: 'cache-hash-mismatch' });
});

test('a sealed descendant cannot relabel captures inherited from another record', async () => {
	const f = evidenceFixture();
	const { id, ...draft } = structuredClone(f.records.second.record);
	draft.scenarios.find((scenario) => scenario.id === 'clock')!.states[0].captures[0].evidence =
		'other-output';
	const item = stored(sealRecord(draft), f.records.second.files);
	expect(item.record.id).not.toBe(id);
	const pointer = f.store.add(item);
	f.store.note(f.commits.changed, [verification(item, pointer)], true);
	const shown = await read(f, asked(f.commits.changed, 'verified', 'current'));
	expect(shown.scope.summary.coverage).toBe('invalid');
	expect(shown.scope.summary.records[0].problems).toContain(
		'scenario clock differs from the states and captures in its inherited record'
	);
	expect(shown.evidence.after.captures).toEqual([]);
});
