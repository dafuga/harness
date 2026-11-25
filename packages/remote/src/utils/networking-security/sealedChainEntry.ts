// @harness-uid u_fefwhwbqf5
import type {
	SealedChainEntry,
	SealedDeviceKeys,
	SealedJsonValue,
	UnsignedChainEntry
} from '../../models/networking-security/Sealed.types';
import { cryptoSource, fromBase64Url, remoteBytes, toBase64Url, toHex } from './remoteBytes';
import { sealedSigningCurve } from './sealedDevice';

const signature = { name: 'ECDSA', hash: 'SHA-256' } as const;

function canonicalValue(value: unknown): string {
	if (Array.isArray(value)) return '[' + value.map(canonicalValue).join(',') + ']';
	if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	const record = value as Record<string, unknown>;
	const fields = Object.keys(record)
		.filter((key) => record[key] !== undefined)
		.sort()
		.map((key) => JSON.stringify(key) + ':' + canonicalValue(record[key]));
	return '{' + fields.join(',') + '}';
}

/** JSON with sorted keys and no spaces; the Swift side writes the same bytes. */
export function sealedCanonical(value: SealedJsonValue): string {
	return canonicalValue(value);
}

/** The signed bytes: label ‖ canonical {at, body, by, prev, seq}. */
export function chainEntryBytes(entry: UnsignedChainEntry): Uint8Array {
	const { seq, prev, at, by, body } = entry;
	return remoteBytes('harness/sealed/v1/chain\0' + sealedCanonical({ seq, prev, at, by, body }));
}

/** Signs an entry with the device's ECDSA P-256 key. `by` must name the signing device. */
export async function sealedChainEntry(
	signer: SealedDeviceKeys,
	entry: UnsignedChainEntry
): Promise<SealedChainEntry> {
	const unsigned = { ...entry, by: signer.deviceId };
	const sig = await crypto.subtle.sign(
		signature,
		signer.signing.privateKey,
		cryptoSource(chainEntryBytes(unsigned))
	);
	return { ...unsigned, sig: toBase64Url(new Uint8Array(sig)) };
}

/** True when `sig` is a valid signature of the entry by this raw public key. */
export async function verifyChainEntry(
	entry: SealedChainEntry,
	signingPublic: string
): Promise<boolean> {
	try {
		const key = await crypto.subtle.importKey(
			'raw',
			cryptoSource(fromBase64Url(signingPublic)),
			sealedSigningCurve,
			false,
			['verify']
		);
		const sig = fromBase64Url(entry.sig);
		if (sig.length !== 64) return false;
		return await crypto.subtle.verify(
			signature,
			key,
			cryptoSource(sig),
			cryptoSource(chainEntryBytes(entry))
		);
	} catch {
		return false;
	}
}

/** Hex SHA-256 of the canonical signed entry; the next entry's `prev`. */
export async function chainEntryHash(entry: SealedChainEntry): Promise<string> {
	const { seq, prev, at, by, body, sig } = entry;
	const bytes = remoteBytes(sealedCanonical({ seq, prev, at, by, body, sig }));
	return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', cryptoSource(bytes))));
}
