import { mkdir, readFile, writeFile } from 'node:fs/promises';

const destination = 'plugins/claude-picker/dist';
await mkdir(destination, { recursive: true });
const script = await readFile('packages/reports/dist/picker/picker.iife.js', 'utf8');
const style = await readFile('packages/reports/dist/picker/harness-reports.css', 'utf8').catch(() =>
	readFile('packages/reports/dist/picker/picker.css', 'utf8')
);
await writeFile(
	`${destination}/panel.html`,
	`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Harness model picker</title><style>${style}</style></head><body><div id="app"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`
);
const result = await Bun.build({
	entrypoints: ['src/cli/picker.ts'],
	target: 'bun',
	outdir: destination,
	naming: 'server.js'
});
if (!result.success) throw new Error('Picker MCP bundle failed.');
