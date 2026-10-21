import type { PairingOffer } from '../../../../../remote/src/utils/pairingOffer';
import {
	offerEnvironment,
	written,
	offerRules,
	shape
} from '../../../../../remote/src/utils/pairingOffer';

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
