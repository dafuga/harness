// @harness-uid u_33kv3kmh5y
import type { ArtboardSize } from './designCanvas.types';

/** The named sizes an artboard can be made with. */
export const artboardPresets: Readonly<Record<string, ArtboardSize>> = {
	desktop: { width: 1440, height: 900 },
	tablet: { width: 834, height: 1194 },
	mobile: { width: 390, height: 844 }
};

const sizeMeta = /<meta\s+name=["']artboard-size["']\s+content=["'](\d{2,4})x(\d{2,4})["']\s*\/?>/i;

/** A preset name or `WIDTHxHEIGHT`; null for anything a canvas cannot show. */
export function parseArtboardSize(text: string): ArtboardSize | null {
	if (Object.hasOwn(artboardPresets, text)) return artboardPresets[text];
	const match = /^(\d{2,4})x(\d{2,4})$/.exec(text);
	return match ? bounded(Number(match[1]), Number(match[2])) : null;
}

/** The fixed size an artboard declares in `<meta name="artboard-size" content="1440x900">`. */
export function artboardSize(html: string): ArtboardSize | null {
	const match = sizeMeta.exec(html);
	return match ? bounded(Number(match[1]), Number(match[2])) : null;
}

function bounded(width: number, height: number): ArtboardSize | null {
	const fits = width >= 100 && width <= 4096 && height >= 100 && height <= 8192;
	return fits ? { width, height } : null;
}
