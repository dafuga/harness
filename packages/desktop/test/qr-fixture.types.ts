/**
 * TEST ONLY. Reads a drawn QR symbol the way a camera would: as pixels, with a decoder that
 * knows nothing of how the symbol was made. The offers are the vectors shared with the phone.
 */
export interface OfferVectors {
	now: number;
	valid: { text: string };
	cases: { name: string; text: string; result: string }[];
}
