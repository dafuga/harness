import { remoteLimits } from '../models/Remote.types';
import { normalizeCode } from './remoteIdentity';

/** The one-time offer a computer shows as a QR code: what a phone asks with, and no credential. */
export interface PairingOffer {
	origin: string;
	hostId: string;
	pairingId: string;
	code: string;
	expiresAt: string;
}
/** Where the relay of an offer is: on the internet, or on the machine of a development fixture. */
export type OfferEnvironment = 'production' | 'local';
/** Why a scanned text is not an offer this build may ask with. */
export type OfferRefusal = 'invalid' | 'unsupported' | 'environment' | 'expired';
export interface OfferReading {
	now: number;
	/** The environments this build accepts. */
	environments: readonly OfferEnvironment[];
}
export type OfferRead = { offer: PairingOffer } | { refused: OfferRefusal };

/** The bounds of the text. `skewMs` is how far the clock of a phone may run behind. */
export const offerRules = {
	version: '1',
	audience: 'harness-phone',
	maxLength: 320,
	skewMs: 60000
} as const;

const name = '[a-z0-9](?:-?[a-z0-9])*';
const port = '(?::([1-9][0-9]{0,4}))?';
/** A named relay: lower-case labels, the last one starting with a letter, never an address. */
const remote = new RegExp(`^https://((?:${name}\\.)*[a-z](?:-?[a-z0-9])*)${port}$`);
const loopback = new RegExp(`^http://(?:127\\.0\\.0\\.1|localhost|\\[::1\\])${port}$`);
const versioned = /^harness-pair:v([0-9]{1,3});/;
/** The whole text, field by field, in the one order it is written in. */
const shape = new RegExp(
	'^harness-pair:v1;aud=([a-z-]{1,32});env=([a-z]{1,16});exp=([0-9]{10})' +
		';host=([a-f0-9]{40});pairing=([a-f0-9]{32});code=([A-HJ-NP-Z2-9]{8});origin=([!-~]{1,200})$'
);
const known: readonly string[] = ['production', 'local'];

/** A port that is written out is a real one, and never the one the scheme already means. */
function allowed(written: string | undefined, standard: number): boolean {
	return written === undefined || (Number(written) <= 65535 && Number(written) !== standard);
}

/** The kind of relay an exact origin names, or null when an offer may not carry it. */
export function offerEnvironment(origin: string): OfferEnvironment | null {
	const far = remote.exec(origin);
	if (far) return far[1] !== 'localhost' && allowed(far[2], 443) ? 'production' : null;
	const near = loopback.exec(origin);
	return near && allowed(near[1], 80) ? 'local' : null;
}

function written(offer: PairingOffer, environment: string): string {
	const { origin, hostId, pairingId } = offer,
		seconds = Math.floor(Date.parse(offer.expiresAt) / 1000);
	const head = `harness-pair:v${offerRules.version};aud=${offerRules.audience};env=${environment}`;
	const code = normalizeCode(offer.code);
	return `${head};exp=${seconds};host=${hostId};pairing=${pairingId};code=${code};origin=${origin}`;
}

/**
 * The text of the QR code for an offer: its fields in one fixed order and nothing else. It is
 * the only text that reads back as this offer; whatever cannot be read back is not written.
 */
export function pairingOffer(offer: PairingOffer): string {
	const environment = offerEnvironment(String(offer.origin));
	const text = environment ? written(offer, environment) : '';
	if (text.length > offerRules.maxLength || !shape.test(text))
		throw new Error('Invalid pairing offer.');
	return text;
}

/** Why the fields of a well-formed text are not an offer for this build now, or null. */
function refusal(found: RegExpExecArray, reading: OfferReading): OfferRefusal | null {
	const [, audience, environment, expiry, , , , origin] = found,
		kind = offerEnvironment(origin),
		ends = Number(expiry) * 1000;
	if (audience !== offerRules.audience) return 'unsupported';
	if (!kind) return 'invalid';
	if (!known.includes(environment)) return 'environment';
	if (environment !== kind) return 'invalid';
	if (!reading.environments.includes(kind)) return 'environment';
	if (ends > reading.now + remoteLimits.pairingTtlMs + offerRules.skewMs) return 'invalid';
	return ends <= reading.now ? 'expired' : null;
}

/**
 * What a scanned text is to this build at this moment: an offer to ask with, or why not. Only
 * the exact text a computer writes is one: no other order, field, spelling, length or version.
 */
export function readPairingOffer(text: string, reading: OfferReading): OfferRead {
	if (typeof text !== 'string' || text.length > offerRules.maxLength) return { refused: 'invalid' };
	const version = versioned.exec(text)?.[1];
	if (version === undefined) return { refused: 'invalid' };
	if (version !== offerRules.version) return { refused: 'unsupported' };
	const found = shape.exec(text);
	if (!found) return { refused: 'invalid' };
	const refused = refusal(found, reading);
	if (refused) return { refused };
	const [, , , expiry, hostId, pairingId, code, origin] = found,
		expiresAt = new Date(Number(expiry) * 1000).toISOString();
	return { offer: { origin, hostId, pairingId, code, expiresAt } };
}
