import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shellVariants, type PreviewVariant } from './entityPreviewData';
import { previewIdentity } from './entityPreviewCapture';

export async function previewShell(home: string, variant: PreviewVariant = ''): Promise<string> {
	const sheets = readdirSync(home).filter((name) => name.endsWith('.css'));
	const hashes = readFileSync(join(home, 'hashes.json'), 'utf8');
	const links = sheets.map((name) => `<link rel="stylesheet" href="/${name}">`).join('');
	const build = JSON.stringify(await previewIdentity());
	const root = shellVariants.has(variant)
		? '<div id="app"></div>'
		: '<div class="hx-shell"><main class="hx-main" id="app"></main></div>';
	return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">${links}</head>
<body>${root}
<script>window.previewBuild=${build};window.previewInitialUrl=location.href;window.artifactHashes=${hashes};window.previewVariant=${JSON.stringify(variant)}</script><script src="/preview.iife.js"></script></body></html>`;
}
