import type {
	OfferReading,
	OfferRefusal,
	OfferRead
} from '../../../utils/networking-security/pairingOffer';
import {
	offerEnvironment,
	offerRules,
	shape
} from '../../../utils/networking-security/pairingOffer';
import { remoteLimits } from '../../../models/networking-security/Remote.types';

const versioned = /^harness-pair:v([0-9]{1,3});/;

const known: readonly string[] = ['production', 'local'];

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
