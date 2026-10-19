

/** A QR symbol as the page draws it: its modules per side, its light margin, its dark runs. */
export interface QrSymbol {
	size: number;
	quiet: number;
	path: string;
}

/** What may be drawn: plain text of a bounded length, at one correction level. */
export const qrLimits = { maxBytes: 320, quiet: 4, maxModules: 77, level: 'M' } as const;

export { qrSymbol } from '../components/remote-offer-code/qrSymbol';
