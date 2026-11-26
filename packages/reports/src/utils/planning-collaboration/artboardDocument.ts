// @harness-uid u_74tqvcb7t5
import type { ArtboardTheme } from './designCanvas.types';

/** Nothing is fetched and nothing runs: an artboard is its own markup, inline styles and data URLs. */
export const artboardPolicy =
	"default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; base-uri 'none'; form-action 'none'";

/**
 * The document a viewer or renderer shows for one artboard. The policy is written before any byte
 * of the artboard, so it holds for everything the artboard asks for. It is one of two walls: a
 * viewer also puts the document in a frame with an empty `sandbox`.
 */
export function artboardDocument(html: string, theme: ArtboardTheme): string {
	return (
		`<!doctype html><html data-theme="${theme}"><meta charset="utf-8">` +
		`<meta http-equiv="Content-Security-Policy" content="${artboardPolicy}">` +
		`<meta name="color-scheme" content="${theme}">` +
		`<style>html,body{margin:0;overflow:hidden}</style>` +
		withoutHints(html.replace(/^\uFEFF?\s*<!doctype[^>]*>/i, ''))
	);
}

/** A policy does not stop a browser's connection hints, so no link element or refresh is kept. */
function withoutHints(html: string): string {
	let shown = html;
	let before: string;
	do {
		before = shown;
		shown = before
			.replace(/<link\b[^>]*>?/gi, '')
			.replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>?/gi, '');
	} while (shown !== before);
	return shown;
}
