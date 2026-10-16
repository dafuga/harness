import { getFileInfo } from 'prettier';
import { expect, test } from 'vitest';

/** Whether the root format check leaves a path alone, by the ignore file it reads. */
const ignored = async (path: string) =>
	(await getFileInfo(path, { ignorePath: '.prettierignore' })).ignored;

test('what the reports package generates is not formatted, and none of its source is left out', async () => {
	// Fixture builds, previews and captures are written by checks: their bytes are what was proved.
	for (const generated of [
		'packages/reports/output/entity-preview/hashes.json',
		'packages/reports/output/entity-preview/preview.iife.js',
		'packages/reports/output/shell-fixture/navbar/page.css',
		'packages/reports/output/evidence/current/captures.json'
	])
		expect([generated, await ignored(generated)]).toEqual([generated, true]);
	// Everything a person writes in the package is still checked, also a folder that only sounds alike.
	for (const source of [
		'packages/reports/src/lib/console.ts',
		'packages/reports/src/lib/styles/explorer.css',
		'packages/reports/tests/e2e/explorer-shell.spec.ts',
		'packages/reports/test/components/harness-navbar.test.ts',
		'packages/reports/package.json',
		'packages/reports/src/output/report.ts',
		'specification/scenarios/explorer-shell.json',
		'harness.verify.json'
	])
		expect([source, await ignored(source)]).toEqual([source, false]);
});
