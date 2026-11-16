import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import type { ExportPlan } from '../../src/core/projects-sessions/exports';
import { applyExports, appendMissingExports } from '../../src/workflows/projects-sessions/generate-code/exports';

test('Appends missing named and type exports in plan order', () => {
	const contents = "export * from './core/exports';\n";
	const plans = [
		{ source: './workflows/projects-sessions/generate-code/exports', named: ['applyExports', 'appendMissingExports'] },
		{ source: './core/projects-sessions/exports', types: ['ExportPlan'] }
	] satisfies ExportPlan[];
	const output = appendMissingExports(contents, plans);
	expect(output).toBe(
		"export * from './core/exports';\nexport { applyExports, appendMissingExports } from './workflows/projects-sessions/generate-code/exports';\nexport type { ExportPlan } from './core/projects-sessions/exports';\n"
	);
	recordExampleCases(
		{
			unitId: 'function.exports',
			symbol: 'appendMissingExports',
			state: 'appends-missing-named-and-type-exports-in-plan-order',
			evidence: 'examples-cases',
			file: 'appends-missing-named-and-type-exports-in-plan-order.json'
		},
		[
			{
				name: 'entry file receives generated function and type exports',
				input: { contents, plans },
				output: { appendedLines: 2, endsWithNewline: true }
			}
		]
	);
});

test('Applies exports to a project entry file only when content changes', async () => {
	await withTempDir('function-exports-', async (root) => {
		const source = join(root, 'src');
		await mkdir(source, { recursive: true });
		const entry = join(source, 'index.ts');
		const initial = "export * from './core/exports';\n";
		await writeFile(entry, initial);
		const plans = [
			{ source: './workflows/projects-sessions/generate-code/exports', named: ['applyExports'] }
		] satisfies ExportPlan[];
		const changed = await applyExports(root, plans);
		const updated = await readFile(entry, 'utf8');
		const unchanged = await applyExports(root, plans);
		expect([changed, updated.endsWith("export { applyExports } from './workflows/projects-sessions/generate-code/exports';\n"), unchanged]).toEqual([
			true,
			true,
			false
		]);
		recordExampleCases(
			{
				unitId: 'function.exports',
				symbol: 'applyExports',
				state: 'applies-exports-to-a-project-entry-file-only-when-content-ch',
				evidence: 'examples-cases',
				file: 'applies-exports-to-a-project-entry-file-only-when-content-ch.json'
			},
			[
				{
					name: 'new export is written once and repeated application is unchanged',
					input: { root: '/workspace/sample-app', plans },
					output: { firstCallChangedFile: changed, secondCallChangedFile: unchanged }
				}
			]
		);
	});
});
