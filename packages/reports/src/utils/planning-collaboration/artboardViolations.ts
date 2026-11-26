// @harness-uid u_ni27mu75b6
import { artboardSize } from './artboardSize';

const refused: readonly [RegExp, string][] = [
	[/<script\b/i, 'has a script; artboards are static markup and styles'],
	[/<(?:link|iframe|frame|object|embed|base|form)\b/i, 'uses link, frame, object, base or form'],
	[/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh/i, 'has a refresh redirect'],
	[/<[a-z][^<>]*\son[a-z]+\s*=/i, 'has an inline event handler'],
	[
		/<[a-z][^<>]*\s(?:src|srcset|poster|background)\s*=\s*(?!["']?\s*(?:data:|#))/i,
		'loads a file; embed it as a data: URL'
	],
	[
		/(?:url\(\s*["']?|@import\s+["'])\s*(?!["']?\s*(?:data:|#|\)))[^"')\s]/i,
		'styles load a file; embed it as a data: URL'
	]
];

/** Why an artboard is not a self-contained, fixed-size page; empty when it is one. */
export function artboardViolations(html: string): string[] {
	const found = artboardSize(html)
		? []
		: ['needs <meta name="artboard-size" content="WIDTHxHEIGHT"> (100-4096 by 100-8192)'];
	const markup = html.replace(/\s+/g, ' ');
	return [...found, ...refused.filter(([rule]) => rule.test(markup)).map(([, reason]) => reason)];
}
