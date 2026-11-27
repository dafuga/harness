import { expect, test } from 'vitest';
import { toHex } from '../../../src/utils/networking-security/remoteBytes';
import {
	newScopeKeys,
	scopeCommitment,
	sealedObjectId,
	sealedScopeKeys
} from '../../../src/utils/networking-security/sealedScopeKeys';

test('imported scope keys cannot be exported again', async () => {
	const keys = await sealedScopeKeys(newScopeKeys());
	expect(keys.dataKey.extractable).toBe(false);
	expect(keys.indexKey.extractable).toBe(false);
	await expect(crypto.subtle.exportKey('raw', keys.dataKey)).rejects.toThrow();
});

test('object ids are stable across rotations and differ by kind, id and scope', async () => {
	const first = newScopeKeys(),
		rotated = newScopeKeys(first),
		other = newScopeKeys();
	expect(rotated.epoch).toBe(1);
	expect(toHex(rotated.scopeId)).toBe(toHex(first.scopeId));
	expect(toHex(rotated.dataKey)).not.toBe(toHex(first.dataKey));
	const [a, b, c] = await Promise.all([first, rotated, other].map(sealedScopeKeys));
	const id = (keys: typeof a, kind: string, local: string) =>
		sealedObjectId(keys!, kind, local).then(toHex);
	expect(await id(a, 'item', 'fx4c15')).toBe(await id(b, 'item', 'fx4c15'));
	expect(await id(a, 'item', 'fx4c15')).not.toBe(await id(a, 'note', 'fx4c15'));
	expect(await id(a, 'item', 'fx4c15')).not.toBe(await id(a, 'item', 'fx4c16'));
	expect(await id(a, 'item', 'fx4c15')).not.toBe(await id(c, 'item', 'fx4c15'));
	expect(await sealedObjectId(a!, 'item', 'x')).toHaveLength(32);
	await expect(sealedObjectId(a!, 'it\0em', 'x')).rejects.toThrow();
});

test('the commitment changes with any key byte, the scope or the epoch', async () => {
	const raw = newScopeKeys();
	const base = toHex(await scopeCommitment(raw));
	const flipped = { ...raw, dataKey: raw.dataKey.slice() };
	flipped.dataKey[0]! ^= 1;
	expect(toHex(await scopeCommitment(flipped))).not.toBe(base);
	expect(toHex(await scopeCommitment({ ...raw, epoch: 1 }))).not.toBe(base);
	const index = { ...raw, indexKey: raw.indexKey.slice() };
	index.indexKey[31]! ^= 1;
	expect(toHex(await scopeCommitment(index))).not.toBe(base);
	await expect(scopeCommitment({ ...raw, dataKey: new Uint8Array(31) })).rejects.toThrow();
});
