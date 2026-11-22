import { test } from 'vitest';
import {
	allowedDirectSrcFiles,
	allowedRootTypeScriptFiles,
	allowedSrcFolders,
	allowedTestFolders
} from '../../src/audit/explorer-ui/structureCatalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

/**
 * Each allowlist this unit exports is consulted the way the structure rules consult it: a name is
 * checked with has on the real Set. Whether each name is listed is asserted and recorded as the
 * cases of its state. The declarations inspect no path, so each name is given on its own.
 */

/** Asks an allowlist whether one name is listed, as a caller does, and keeps the answer. */
function consult(list: ReadonlySet<string>, name: string, label: string) {
	return { name: label, input: { name }, output: list.has(name) };
}

test('allowedSrcFolders tells listed source folders from others', () => {
	const cases = [
		consult(allowedSrcFolders, 'services', 'services, a source folder under src that is listed'),
		consult(allowedSrcFolders, 'workflows', 'workflows, a source folder under src that is listed'),
		consult(allowedSrcFolders, 'scripts', 'scripts, a repository folder outside src')
	];
	expect(allowedSrcFolders instanceof Set).toBe(true);
	expect(cases.map((item) => item.output)).toEqual([true, true, false]);
	recordExampleCases(
		{
			unitId: 'audit.structure-catalog',
			symbol: 'allowedSrcFolders',
			state: 'allowedsrcfolders-tells-listed-source-folders-from-others',
			evidence: 'examples-cases',
			file: 'allowedsrcfolders-tells-listed-source-folders-from-others.json'
		},
		cases
	);
});

test('allowedTestFolders tells listed test folders from others', () => {
	const cases = [
		consult(allowedTestFolders, 'services', 'services, a test folder that is listed'),
		consult(allowedTestFolders, 'support', 'support, a shared test helper folder that is listed'),
		consult(allowedTestFolders, 'archive', 'archive, a folder that is not listed')
	];
	expect(allowedTestFolders instanceof Set).toBe(true);
	expect(cases.map((item) => item.output)).toEqual([true, true, false]);
	recordExampleCases(
		{
			unitId: 'audit.structure-catalog',
			symbol: 'allowedTestFolders',
			state: 'allowedtestfolders-tells-listed-test-folders-from-others',
			evidence: 'examples-cases',
			file: 'allowedtestfolders-tells-listed-test-folders-from-others.json'
		},
		cases
	);
});

test('allowedRootTypeScriptFiles tells listed files from others', () => {
	const cases = [
		consult(
			allowedRootTypeScriptFiles,
			'vitest.config.ts',
			'vitest.config.ts, a root config file that is listed'
		),
		consult(
			allowedRootTypeScriptFiles,
			'vite.config.ts',
			'vite.config.ts, another root config file that is listed'
		),
		consult(
			allowedRootTypeScriptFiles,
			'index.ts',
			'index.ts, a root implementation file that is not listed'
		)
	];
	expect(allowedRootTypeScriptFiles instanceof Set).toBe(true);
	expect(cases.map((item) => item.output)).toEqual([true, true, false]);
	recordExampleCases(
		{
			unitId: 'audit.structure-catalog',
			symbol: 'allowedRootTypeScriptFiles',
			state: 'allowedroottypescriptfiles-tells-listed-files-from-others',
			evidence: 'examples-cases',
			file: 'allowedroottypescriptfiles-tells-listed-files-from-others.json'
		},
		cases
	);
});

test('allowedDirectSrcFiles tells listed src files from others', () => {
	const cases = [
		consult(
			allowedDirectSrcFiles,
			'index.ts',
			'index.ts, the entry file directly under src that is listed'
		),
		consult(
			allowedDirectSrcFiles,
			'hooks.server.ts',
			'hooks.server.ts, a hook file directly under src that is listed'
		),
		consult(allowedDirectSrcFiles, 'helpers.ts', 'helpers.ts, a code file that is not listed')
	];
	expect(allowedDirectSrcFiles instanceof Set).toBe(true);
	expect(cases.map((item) => item.output)).toEqual([true, true, false]);
	recordExampleCases(
		{
			unitId: 'audit.structure-catalog',
			symbol: 'allowedDirectSrcFiles',
			state: 'alloweddirectsrcfiles-tells-listed-src-files-from-others',
			evidence: 'examples-cases',
			file: 'alloweddirectsrcfiles-tells-listed-src-files-from-others.json'
		},
		cases
	);
});
