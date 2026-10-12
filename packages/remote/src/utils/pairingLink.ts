import { remotePatterns } from './remoteIdentity';
import { relayOrigin } from './relayOrigin';

export interface PairingLink {
	origin: string;
	hostId: string;
	pairingId: string;
}
const prefix = 'harnessremote://pair?';

function checked(origin: string | null, hostId: string, pairingId: string): PairingLink | null {
	const valid = remotePatterns.hostId.test(hostId) && remotePatterns.pairingId.test(pairingId);
	return origin && valid ? { origin, hostId, pairingId } : null;
}
/** What a QR code or a copied link holds: public identifiers, no code and no credential. */
export function pairingLink(link: PairingLink): string {
	const exact = checked(relayOrigin(link.origin), link.hostId, link.pairingId);
	if (!exact) throw new Error('Invalid pairing link.');
	return `${prefix}origin=${encodeURIComponent(exact.origin)}&host=${exact.hostId}&pairing=${exact.pairingId}`;
}
/** Null unless the text is exactly such a link: any extra field, such as a code, refuses it. */
export function parsePairingLink(text: string): PairingLink | null {
	if (!text.startsWith(prefix)) return null;
	const fields = new URLSearchParams(text.slice(prefix.length));
	if ([...fields.keys()].sort().join(',') !== 'host,origin,pairing') return null;
	return checked(
		relayOrigin(fields.get('origin') ?? undefined),
		fields.get('host') ?? '',
		fields.get('pairing') ?? ''
	);
}
