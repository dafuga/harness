import type { PairingOffer } from '../../src/utils/pairingOffer';
import type { OfferEnvironment } from '../../src/utils/pairingOffer';

export interface OfferVectors {
	now: number;
	valid: { text: string; offer: PairingOffer };
	cases: { name: string; text: string; environments: OfferEnvironment[]; result: string }[];
}
