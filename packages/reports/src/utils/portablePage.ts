import type { Report } from '../models/Report.types';

/** The compiled report viewer: one script and one stylesheet, as text. */
export interface PortableAssets {
	script: string;
	style: string;
}

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char
	);
}

/** Wraps a report whose media is already inline into one self-contained page. */
export function portablePage(portable: Report, assets: PortableAssets): string {
	const data = JSON.stringify(portable)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(portable.title)} · Project reports</title><style>${assets.style}</style></head><body><div id="app"></div><script>window.projectReport=${data};</script><script>${assets.script}</script></body></html>`;
}
