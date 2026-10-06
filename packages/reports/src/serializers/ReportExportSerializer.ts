import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Report } from '../models/Report.types';
import { registeredAsset } from '../utils/reportAssets';
import { mediaMime } from '../utils/evidenceMedia';
export class ReportExportSerializer {
	constructor(private readonly appRoot: string) {}
	async html(report: Report, directory: string) {
		const bundle = join(this.appRoot, 'dist', 'viewer');
		const [script, style] = await Promise.all([
			readFile(join(bundle, 'report.iife.js'), 'utf8'),
			readFile(join(bundle, 'report.css'), 'utf8')
		]);
		const portable = structuredClone(report);
		for (const item of portable.evidence) {
			if (item.missing) continue;
			const path = await registeredAsset(
				join(directory, 'assets'),
				item.file,
				report.evidence.map((value) => value.file)
			);
			const mime = mediaMime(item.file);
			item.file = `data:${mime};base64,${(await readFile(path)).toString('base64')}`;
		}
		const data = JSON.stringify(portable)
			.replace(/</g, '\\u003c')
			.replace(/\u2028/g, '\\u2028')
			.replace(/\u2029/g, '\\u2029');
		return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.title)} · Project reports</title><style>${style}</style></head><body><div id="app"></div><script>window.projectReport=${data};</script><script>${script}</script></body></html>`;
	}
}
function escapeHtml(value: string) {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char
	);
}
