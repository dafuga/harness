import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type {
	SealedChainEntry,
	SealedChainState
} from '../../../src/models/networking-security/Sealed.types';
import {
	cryptoSource,
	fromBase64Url,
	toBase64Url,
	toHex
} from '../../../src/utils/networking-security/remoteBytes';
import {
	chainEntryHash,
	verifyChainEntry
} from '../../../src/utils/networking-security/sealedChainEntry';
import { sealedKemCurve } from '../../../src/utils/networking-security/sealedDevice';
import {
	openSealedFrame,
	sealedStreamKey
} from '../../../src/utils/networking-security/sealedFrame';
import { openSealedGrant } from '../../../src/utils/networking-security/sealedGrant';
import { openSealedRecord } from '../../../src/utils/networking-security/sealedRecord';
import { checkEnrollCommit, sealedSas } from '../../../src/utils/networking-security/sealedSas';
import {
	sealedObjectId,
	sealedScopeKeys
} from '../../../src/utils/networking-security/sealedScopeKeys';

/** Frozen; written once by scripts/sealed-vectors.ts, mostly with node:crypto. */
const vectors = JSON.parse(
	readFileSync(new URL('../../support/sealed-vectors.json', import.meta.url), 'utf8')
);
const raw = {
	scopeId: fromBase64Url(vectors.scope.scopeId),
	epoch: vectors.scope.epoch,
	dataKey: fromBase64Url(vectors.scope.dataKey),
	indexKey: fromBase64Url(vectors.scope.indexKey)
};

test('commitment, object id, record and frame match the independent vectors', async () => {
	const keys = await sealedScopeKeys(raw);
	expect(toBase64Url(keys.commitment)).toBe(vectors.scope.commitment);
	expect(
		toBase64Url(await sealedObjectId(keys, vectors.objectId.kind, vectors.objectId.localId))
	).toBe(vectors.objectId.id);
	const record = await openSealedRecord(keys, fromBase64Url(vectors.record.envelope));
	expect(record.value).toEqual(vectors.record.value);
	expect(record.header.revision.toString()).toBe(vectors.record.revision);
	const streamKey = await sealedStreamKey(keys, fromBase64Url(vectors.frame.streamId));
	const frame = await openSealedFrame(keys, streamKey, fromBase64Url(vectors.frame.envelope));
	expect(new TextDecoder().decode(frame.data)).toBe(vectors.frame.text);
});

test('enrollment commit and code match the vectors', async () => {
	const v = vectors.enroll;
	const request = {
		kemPublic: fromBase64Url(v.kemPublic),
		signingPublic: fromBase64Url(v.signingPublic)
	};
	expect(await checkEnrollCommit(request, fromBase64Url(v.requestNonce), v.commit)).toBe(true);
	const code = await sealedSas({
		request,
		requestNonce: fromBase64Url(v.requestNonce),
		approverSigningPublic: fromBase64Url(v.approverSigningPublic),
		approverNonce: fromBase64Url(v.approverNonce)
	});
	expect(code).toBe(v.sas);
});

test('the node-signed chain entry verifies and hashes the same', async () => {
	const entry = vectors.chainEntry.entry as SealedChainEntry;
	expect(await verifyChainEntry(entry, vectors.chainEntry.signingPublic)).toBe(true);
	expect(await chainEntryHash(entry)).toBe(vectors.chainEntry.hash);
});

test('the HPKE grant opens with the fixed recipient key into the committed keys', async () => {
	const g = vectors.grant;
	const publicKey = fromBase64Url(g.recipientPublic);
	const jwk = {
		kty: 'EC',
		crv: 'P-256',
		d: g.recipientD,
		x: toBase64Url(publicKey.subarray(1, 33)),
		y: toBase64Url(publicKey.subarray(33))
	};
	const kem = {
		privateKey: await crypto.subtle.importKey('jwk', jwk, sealedKemCurve, false, ['deriveBits']),
		publicKey: await crypto.subtle.importKey(
			'raw',
			cryptoSource(publicKey),
			sealedKemCurve,
			true,
			[]
		)
	};
	const self = {
		deviceId: g.device,
		kem,
		signing: kem,
		kemPublic: publicKey,
		signingPublic: publicKey
	};
	const chain: SealedChainState = {
		account: g.account,
		seq: 0,
		head: '',
		devices: {
			[g.device]: {
				deviceId: g.device,
				kemPublic: g.recipientPublic,
				signingPublic: '',
				role: 'admin',
				scopes: [g.scope],
				active: true
			}
		},
		scopes: {
			[g.scope]: {
				epoch: g.epoch,
				commitments: { [g.epoch]: vectors.scope.commitment },
				stale: false
			}
		}
	};
	const keys = await openSealedGrant(g, self, chain);
	expect(toHex(keys.commitment)).toBe(toHex(fromBase64Url(vectors.scope.commitment)));
});
