import type { PanelSummary } from './script.build-picker.test.types';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';

const scriptPath = fileURLToPath(new URL('../../scripts/build-picker.ts', import.meta.url));

const pickerScript = 'window.pickerReady = "model-picker";';
const pickerEntry = 'export const picker: string = "model-picker";\nconsole.log(picker);\n';
const reportsStyle = '.picker { color: #123456; }';
const fallbackStyle = '.picker { color: #abcdef; }';

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
	for (const [path, content] of Object.entries(files)) {
		const target = join(root, path);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, content);
	}
}

// Stand-in for Bun.build: the tests run under Node, where Bun is not defined.
// It copies the entry into the output folder, or fails on the broken entry.
const fakeBun = {
	build: async (options: { entrypoints: string[]; outdir: string; naming: string }) => {
		const source = await readFile(options.entrypoints[0], 'utf8');
		if (source.includes('= ;')) return { success: false };
		await writeFile(join(options.outdir, options.naming), source);
		return { success: true };
	}
};

// The script has no export: importing it runs it against the current directory.
async function runBuildPicker(root: string, runId: string): Promise<void> {
	const previous = process.cwd();
	const previousBun = Reflect.get(globalThis, 'Bun');
	process.chdir(root);
	Reflect.set(globalThis, 'Bun', fakeBun);
	try {
		await import(/* @vite-ignore */ `${scriptPath}?run=${runId}`);
	} finally {
		process.chdir(previous);
		if (previousBun === undefined) Reflect.deleteProperty(globalThis, 'Bun');
		else Reflect.set(globalThis, 'Bun', previousBun);
	}
}

async function buildPanel(files: Record<string, string>, runId: string): Promise<PanelSummary> {
	return withTempDir('build-picker-', async (root) => {
		await writeFiles(root, files);
		await runBuildPicker(root, runId);
		const panel = await readFile(join(root, 'plugins/claude-picker/dist/panel.html'), 'utf8');
		const server = await readFile(join(root, 'plugins/claude-picker/dist/server.js'), 'utf8');
		return {
			title: panel.match(/<title>(.*?)<\/title>/)?.[1] ?? '',
			styleColor: panel.match(/color: (#\w+)/)?.[1] ?? null,
			hasScript: panel.includes('window.pickerReady'),
			serverBundled: server.includes('model-picker')
		};
	});
}

async function captureFailure(root: string): Promise<{ name: string; message: string }> {
	let error: unknown;
	try {
		await runBuildPicker(root, 'broken');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	expect(actual.message).toBe('Picker MCP bundle failed.');
	return { name: actual.name, message: actual.message };
}

test('Bundles the picker panel with its style and the server script', async () => {
	const summary = await buildPanel(
		{
			'packages/reports/dist/picker/picker.iife.js': pickerScript,
			'packages/reports/dist/picker/harness-reports.css': reportsStyle,
			'src/cli/picker.ts': pickerEntry
		},
		'bundle'
	);
	expect(summary.title).toBe('Harness model picker');
	expect(summary.styleColor).toBe('#123456');
	expect(summary.hasScript).toBe(true);
	expect(summary.serverBundled).toBe(true);

	recordExampleCases(
		{
			unitId: 'script.build-picker',
			symbol: 'module',
			state: 'bundles-the-picker-panel-with-its-style-and-the-server-scrip',
			evidence: 'examples-cases',
			file: 'bundles-the-picker-panel-with-its-style-and-the-server-scrip.json'
		},
		[
			{
				name: 'uses harness-reports.css when it exists',
				input: { files: ['picker.iife.js', 'harness-reports.css', 'src/cli/picker.ts'] },
				output: summary
			}
		]
	);
});

test('Falls back to picker.css when harness-reports.css is missing', async () => {
	const summary = await buildPanel(
		{
			'packages/reports/dist/picker/picker.iife.js': pickerScript,
			'packages/reports/dist/picker/picker.css': fallbackStyle,
			'src/cli/picker.ts': pickerEntry
		},
		'fallback'
	);
	expect(summary.styleColor).toBe('#abcdef');
	expect(summary.hasScript).toBe(true);

	recordExampleCases(
		{
			unitId: 'script.build-picker',
			symbol: 'module',
			state: 'falls-back-to-picker-css-when-harness-reports-css-is-missing',
			evidence: 'examples-cases',
			file: 'falls-back-to-picker-css-when-harness-reports-css-is-missing.json'
		},
		[
			{
				name: 'uses picker.css when harness-reports.css is absent',
				input: { files: ['picker.iife.js', 'picker.css', 'src/cli/picker.ts'] },
				output: summary
			}
		]
	);
});

test('Rejects with a bundle error when the picker entry does not compile', async () => {
	const error = await withTempDir('build-picker-broken-', async (root) => {
		await writeFiles(root, {
			'packages/reports/dist/picker/picker.iife.js': pickerScript,
			'packages/reports/dist/picker/harness-reports.css': reportsStyle,
			'src/cli/picker.ts': 'export const picker = ;\n'
		});
		return captureFailure(root);
	});

	recordExampleCases(
		{
			unitId: 'script.build-picker',
			symbol: 'module',
			state: 'rejects-with-a-bundle-error-when-the-picker-entry-does-not-c',
			evidence: 'examples-cases',
			file: 'rejects-with-a-bundle-error-when-the-picker-entry-does-not-c.json'
		},
		[
			{
				name: 'throws when Bun.build reports failure for src/cli/picker.ts',
				input: { entry: 'export const picker = ;' },
				error
			}
		]
	);
});
