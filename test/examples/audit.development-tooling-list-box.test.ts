import { test } from 'vitest';
import { svelteAdapter } from '../../src/audit/development-tooling/adapters/svelte';
import type { AuditFile } from '../../src/audit/development-tooling/adapters/types';
import { maskTemplateLiterals, splitLines } from '../../src/audit/development-tooling/commonRules';
import { harnessRuleLimits } from '../../src/rules/explorer-ui/catalog';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const symbol = 'svelteAdapter';
const relativePath = 'src/components/Picker.svelte';
const script = '<script lang="ts">let value = "";</script>\n';

function file(contents: string): AuditFile {
	return {
		absolutePath: `/example/project/${relativePath}`,
		relativePath,
		extension: '.svelte',
		contents,
		lines: splitLines(contents),
		structuralLines: splitLines(maskTemplateLiterals(contents)),
		limits: harnessRuleLimits,
		size: Buffer.byteLength(contents)
	};
}

/** Runs the real Svelte adapter and keeps only the list-box findings. */
function run(markup: string) {
	const contents = `${script}${markup}\n`;
	const output = svelteAdapter
		.audit(file(contents))
		.filter((finding) => finding.rule === 'native-list-box');
	return { input: { relativePath, contents }, output };
}

function meta(state: string) {
	return {
		unitId: 'audit.development-tooling-list-box',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

const message =
	'Use the shared list rows for a picker, not a native list box (select[size] or multiple); only a form dialog may hold one.';

test('Reports a native list box outside a form dialog', () => {
	const state = 'reports-a-native-list-box-outside-a-form-dialog';
	const picker = run(
		'<select size="5"><option>main</option><option>dev</option></select><select multiple><option>a</option></select>'
	);
	expect(picker.output).toEqual([
		{ path: relativePath, rule: 'native-list-box', message },
		{ path: relativePath, rule: 'native-list-box', message }
	]);
	const dialog = run(
		'<Modal open title="Branch"><select size="4"><option>main</option></select></Modal>'
	);
	expect(dialog.output).toEqual([{ path: relativePath, rule: 'native-list-box', message }]);

	recordExampleCases(meta(state), [
		{ name: 'reports select[size] and multiple', ...picker },
		{ name: 'reports a list box in a dialog without a form', ...dialog }
	]);
});

test('Allows a list box held by a form dialog and the shared Select', () => {
	const state = 'allows-a-list-box-held-by-a-form-dialog-and-the-shared-select';
	const formDialog = run(
		'<Modal open title="New project"><form><select size="4"><option>main</option></select></form></Modal>'
	);
	expect(formDialog.output).toEqual([]);
	const plain = run('<select><option>main</option></select><Select value="main" />');
	expect(plain.output).toEqual([]);

	recordExampleCases(meta(state), [
		{ name: 'allows a list box inside a form dialog', ...formDialog },
		{ name: 'allows a single-value select and the shared Select', ...plain }
	]);
});
