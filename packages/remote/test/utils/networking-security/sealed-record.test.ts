import { expect, test } from 'vitest';
import { SealedError } from '../../../src/models/networking-security/SealedError';
import {
	openSealedRecord,
	sealedRecord,
	sealedRecordHeader
} from '../../../src/utils/networking-security/sealedRecord';
import {
	newScopeKeys,
	sealedObjectId,
	sealedScopeKeys
} from '../../../src/utils/networking-security/sealedScopeKeys';
import { toHex } from '../../../src/utils/networking-security/remoteBytes';

async function fixture() {
	const raw = newScopeKeys();
	const keys = await sealedScopeKeys(raw);
	const objectId = await sealedObjectId(keys, 'item', 'fx4c15');
	return { raw, keys, objectId };
}

test('a record round-trips and exposes only its header', async () => {
	const { keys, objectId } = await fixture();
	const value = { kind: 'item', title: 'Ship sealed sync', notes: ['one', 'two'] };
	const envelope = await sealedRecord(keys, { objectId, revision: 7n }, value);
	const header = sealedRecordHeader(envelope);
	expect(header.epoch).toBe(0);
	expect(header.revision).toBe(7n);
	expect(toHex(header.objectId)).toBe(toHex(objectId));
	expect((await openSealedRecord(keys, envelope)).value).toEqual(value);
});

test('sealing twice gives different bytes, and padded sizes hide small differences', async () => {
	const { keys, objectId } = await fixture();
	const a = await sealedRecord(keys, { objectId, revision: 1n }, { t: 'a' });
	const b = await sealedRecord(keys, { objectId, revision: 1n }, { t: 'a' });
	const c = await sealedRecord(keys, { objectId, revision: 1n }, { t: 'a'.repeat(150) });
	expect(toHex(a)).not.toBe(toHex(b));
	expect(a.length).toBe(c.length);
});

test('every changed byte of the header, salt, nonce or ciphertext fails to open', async () => {
	const { keys, objectId } = await fixture();
	const envelope = await sealedRecord(keys, { objectId, revision: 3n }, { secret: 'value' });
	const positions = [...Array(89).keys(), 89, 120, envelope.length - 17, envelope.length - 1];
	for (const position of positions) {
		const changed = envelope.slice();
		changed[position]! ^= 0x01;
		await expect(openSealedRecord(keys, changed), `byte ${position}`).rejects.toThrow(SealedError);
	}
	await expect(openSealedRecord(keys, envelope.slice(0, -1))).rejects.toThrow(SealedError);
});

test('other scope keys, another epoch, or the next epoch keys cannot open it', async () => {
	const { raw, keys, objectId } = await fixture();
	const envelope = await sealedRecord(keys, { objectId, revision: 1n }, { a: 1 });
	const other = await sealedScopeKeys(newScopeKeys());
	const next = await sealedScopeKeys(newScopeKeys(raw));
	const sameIdsWrongKey = await sealedScopeKeys({
		...newScopeKeys(),
		scopeId: raw.scopeId,
		epoch: 0
	});
	await expect(openSealedRecord(other, envelope)).rejects.toThrow(SealedError);
	await expect(openSealedRecord(next, envelope)).rejects.toThrow(SealedError);
	await expect(openSealedRecord(sameIdsWrongKey, envelope)).rejects.toThrow('authentication');
});

test('headers out of range are refused before sealing', async () => {
	const { keys, objectId } = await fixture();
	await expect(sealedRecord(keys, { objectId, revision: -1n }, {})).rejects.toThrow(SealedError);
	await expect(
		sealedRecord(keys, { objectId: new Uint8Array(31), revision: 0n }, {})
	).rejects.toThrow(SealedError);
	expect(() => sealedRecordHeader(new Uint8Array(10))).toThrow(SealedError);
});
