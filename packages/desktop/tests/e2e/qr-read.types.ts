/**
 * TEST ONLY. Reads what is on the screen the way a camera would: a screenshot of the drawn
 * symbol, and a decoder that knows nothing of how the symbol was made.
 */
export interface Picture {
	width: number;
	height: number;
	channels: number;
	rows: Buffer;
}
