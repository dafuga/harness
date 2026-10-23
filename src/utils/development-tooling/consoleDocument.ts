import type { ConsoleAssets, ConsoleDocumentOptions } from './consoleDocument.types';

function escapeHtml(value: string): string {
	const entities: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;'
	};
	return value.replace(/[&<>"]/g, (char) => entities[char] ?? char);
}

/**
 * Text inlined into an element may not contain that element's closing tag, nor the comment
 * opener that makes a parser treat a later closing tag as script text.
 */
function inlined(text: string, tag: string): string {
	return text.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`).replace(/<!--/g, '<\\!--');
}

/**
 * The whole console as one HTML document. It holds the viewer and nothing else: history and
 * media are fetched from the host's protected endpoints once the document runs, so serving it
 * only after the policy admits the request keeps the viewer private too.
 */
export function consoleDocument(assets: ConsoleAssets, options: ConsoleDocumentOptions): string {
	const settings = JSON.stringify({ exportable: false, ...options }).replace(/</g, '\\u003c');
	return [
		'<!doctype html><html lang="en"><head><meta charset="utf-8">',
		'<meta name="viewport" content="width=device-width,initial-scale=1">',
		'<meta name="robots" content="noindex">',
		`<title>${escapeHtml(options.title ?? 'Harness')}</title>`,
		`<style>${inlined(assets.style, 'style')}</style></head>`,
		'<body><div id="app"></div>',
		`<script>window.harnessConsole=${settings};</script>`,
		`<script>${inlined(assets.script, 'script')}</script></body></html>`
	].join('');
}

export type { ConsoleAssets, ConsoleDocumentOptions } from './consoleDocument.types';
