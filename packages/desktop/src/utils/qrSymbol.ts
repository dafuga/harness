import { create } from 'qrcode';

/** A QR symbol as the page draws it: its modules per side, its light margin, its dark runs. */
export interface QrSymbol {
	size: number;
	quiet: number;
	path: string;
}
/** What may be drawn: plain text of a bounded length, at one correction level. */
export const qrLimits = { maxBytes: 320, quiet: 4, maxModules: 77, level: 'M' } as const;
const plain = /^[!-~]+$/;
const refused = 'This cannot be shown as a QR code.';

/** The dark runs of one row as closed boxes, each one module high, inside the margin. */
function row(dark: (column: number) => boolean, size: number, y: number): string {
	let path = '';
	for (let x = 0; x < size; x++) {
		if (!dark(x)) continue;
		let length = 1;
		while (x + length < size && dark(x + length)) length++;
		path += `M${x + qrLimits.quiet} ${y + qrLimits.quiet}h${length}v1h-${length}z`;
		x += length;
	}
	return path;
}

/**
 * The one place a QR symbol is made. The algorithm is the `qrcode` package's; this bounds what
 * is handed to it and turns its modules into a path. Text that does not fit is refused.
 */
export function qrSymbol(text: string): QrSymbol {
	if (!plain.test(text) || text.length > qrLimits.maxBytes) throw new Error(refused);
	const { modules } = create(text, { errorCorrectionLevel: qrLimits.level });
	const { size } = modules;
	if (size > qrLimits.maxModules) throw new Error(refused);
	let path = '';
	for (let y = 0; y < size; y++) path += row((x) => Boolean(modules.get(y, x)), size, y);
	return { size, quiet: qrLimits.quiet, path };
}
