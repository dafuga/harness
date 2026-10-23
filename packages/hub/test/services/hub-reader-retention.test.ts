import type { Fixture } from './hub-reader-retention.test.types';
import { expect, test } from 'vitest';
import { sealRecord } from '../../../../src/utils/sealRecord';
import { asked, bound, bytesOf, evidenceFixture, read, sourceAt } from '../support/evidenceFixture';
import { attachedAt } from '../support/evidenceReaders';
import { png, stored, sha256 } from '../support/evidenceRecords';

const shot = 'captures/titles-default-desktop.png';

/** The first record with 24 more half-megabyte captures, sealed again under its own id. */
function largeRecord(f: Fixture) {
	const { id, ...draft } = structuredClone(f.records.first.record);
	const files = new Map(f.records.first.files);
	for (let index = 0; index < 24; index++) {
		const bytes = png(`capture ${index}`, 512 * 1024),
			path = `captures/extra-${index}.png`;
		files.set(path, bytes);
		draft.scenarios[0].states[0].captures.push({
			...draft.scenarios[0].states[0].captures[0],
			path,
			evidence: `extra-${index}`,
			sha256: sha256(bytes),
			bytes: bytes.length
		});
	}
	return { id, files, item: stored(sealRecord(draft), files) };
}

/** Counts what the source reads and holds at once, and any large value the cache is given. */
function watched(f: Fixture) {
	const retained = new Map<string, Uint8Array>();
	const seen = { peak: 0, reads: 0, cachedLarge: 0 };
	const sourceRead = f.source.read;
	f.source.read = async (repository, input) => {
		const bytes = await sourceRead(repository, input);
		retained.set(`${input.commit}:${input.path}`, bytes);
		seen.reads++;
		seen.peak = Math.max(
			seen.peak,
			[...retained.values()].reduce((sum, value) => sum + value.length, 0)
		);
		return bytes;
	};
	Object.assign(f.source, {
		releaseBytes: (_repository: unknown, input: { commit: string; path: string }) =>
			retained.delete(`${input.commit}:${input.path}`)
	});
	const put = f.cache.put;
	f.cache.put = async (key, entry) => {
		if (entry.bytes.length >= 512 * 1024) seen.cachedLarge++;
		await put(key, entry);
	};
	return { retained, seen };
}

test('large records validate every file sequentially and retain only record bytes and facts', async () => {
	const f = evidenceFixture();
	const { id, files, item } = largeRecord(f);
	expect(item.record.id).not.toBe(id);
	const pointer = f.store.add(item);
	const { retained, seen } = watched(f);
	const attached = attachedAt(f, await sourceAt(f, f.commits.root), pointer.commit);
	const loaded = await attached.load(pointer);
	expect(loaded.problems).toEqual([]);
	expect([...loaded.files.keys()]).toEqual(['record.json']);
	expect(loaded.facts.size).toBe(item.tree.size - 1);
	expect([...files.values()].reduce((sum, bytes) => sum + bytes.length, 0)).toBeGreaterThan(
		11 * 1024 * 1024
	);
	expect([...loaded.facts.values()].every(Object.isFrozen)).toBe(true);
	for (const [path, bytes] of files)
		expect(loaded.facts.get(path)).toMatchObject({
			path,
			sha256: sha256(bytes),
			bytes: bytes.length
		});
	expect(seen.reads).toBe(25);
	expect(seen.peak).toBeLessThanOrEqual(512 * 1024);
	expect(retained.size).toBe(0);
	expect(seen.cachedLarge).toBe(0);
	expect(await attached.readFile(pointer, shot)).toEqual(files.get(shot));
});

test('selected artifact bytes are read again and a post-validation mutation is refused', async () => {
	const f = evidenceFixture();
	const query = asked(f.commits.changed, 'verified', 'current');
	const sourceRead = f.source.read;
	let reads = 0;
	f.source.read = async (repository, input) => {
		const bytes = await sourceRead(repository, input);
		if (input.commit === f.pointers.second.commit && input.path.endsWith(shot)) {
			reads++;
			if (reads === 3) {
				const corrupt = new Uint8Array(bytes);
				corrupt[0] ^= 0xff;
				return corrupt;
			}
		}
		return bytes;
	};
	const selected = bound(await read(f, query), query);
	await expect(bytesOf(f, selected)).rejects.toMatchObject({ code: 'artifact-refused' });
	expect(reads).toBe(3);
});

test('selected branch is the evidence identity ref while source commit and tree stay pinned', async () => {
	const f = evidenceFixture();
	const result = await read(f, asked(f.commits.changed, 'main', 'commit'));
	expect(result.identity.requestedRef).toBe('main');
	expect(result.identity.sourceCommit).toBe(f.commits.changed);
	expect(result.identity.sourceTree).toBe(f.git.tree(f.commits.changed));
});
