import { parsePairingLink, type PairingLink } from '../../../remote/src/utils/pairingLink';
import type { PairingInput } from '../models/Environment.types';

export interface PairingFields {
	link: string;
	code: string;
	deviceName: string;
}
export const linkNotice =
	'Paste the pairing link your computer shows. Its relay must be an https:// address.';
export const codeNotice = 'Type the 8-character code your computer shows.';
export const nameNotice = 'Give this phone a name of up to 80 characters.';

const code = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const loopback = /^(localhost|127(\.\d+){3}|0\.0\.0\.0|\[::1\])$/;

/** An exact https origin of another machine: no path, no user, and never this device itself. */
function trusted(value: string | null): string | null {
	let url: URL;
	try {
		url = new URL(value ?? '');
	} catch {
		return null;
	}
	if (url.origin !== value || url.protocol !== 'https:') return null;
	return loopback.test(url.hostname) ? null : url.origin;
}

/**
 * The public identifiers of a pairing link, or null. The link is read by the rule of the
 * protocol: exactly its three fields, so one that also carries a code is refused. A phone is
 * stricter about the relay than a development machine: https only, and never this device.
 * Only where the native plugin states that it is a Debug build started for a local test
 * fixture is a relay on this machine accepted; the page has no switch of its own for that.
 */
export function pairingTarget(value: string, fixture = false): PairingLink | null {
	const text = value.trim();
	const link = parsePairingLink(text);
	if (!link) return null;
	/** A Debug build started for a test fixture takes the rule of the protocol as it is. */
	if (fixture) return link;
	const stated = new URLSearchParams(text.slice(text.indexOf('?') + 1)).get('origin');
	return trusted(stated) === link.origin ? link : null;
}

/**
 * What a person typed, as the request the plugin pairs with, or the words that say what is
 * missing. Nothing is sent anywhere for the latter.
 */
export function pairingInput(
	fields: PairingFields,
	fixture = false
): { input: PairingInput } | { error: string } {
	const target = pairingTarget(fields.link, fixture);
	if (!target) return { error: linkNotice };
	const typed = fields.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
	if (!code.test(typed)) return { error: codeNotice };
	const deviceName = fields.deviceName.trim();
	if (!deviceName || deviceName.length > 80) return { error: nameNotice };
	return { input: { ...target, code: typed, deviceName } };
}
