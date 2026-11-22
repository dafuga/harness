import { test } from 'vitest';
import { auditAtomicComposition } from '../../src/audit/development-tooling/atomicComposition';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';

const symbol = 'auditAtomicComposition';

const limits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};

function sourceFile(relativePath: string, contents: string): Parameters<typeof auditAtomicComposition>[0] {
	return {
		absolutePath: `/workspace/project/${relativePath}`,
		relativePath,
		extension: '.svelte',
		contents,
		lines: contents.split('\n'),
		structuralLines: contents.split('\n'),
		limits,
		size: contents.length
	};
}

function run(relativePath: string, contents: string) {
	const output = auditAtomicComposition(sourceFile(relativePath, contents));
	return { input: { relativePath, contents }, output };
}

function meta(state: string) {
	return { unitId: 'audit.development-tooling-atomic-composition', symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

test('Ignores files outside the component and route folders', () => {
	const state = 'ignores-files-outside-the-component-and-route-folders';
	const library = run('src/lib/Button.svelte', '<div>Save</div>');
	expect(library.output).toEqual([]);

	recordExampleCases(meta(state), [{ name: 'skips a library file', ...library }]);
});

test('Reports the missing tier and native elements in a component', () => {
	const state = 'reports-the-missing-tier-and-native-elements-in-a-component';
	const component = run('src/components/Button.svelte', '<div>Save</div>');
	expect(component.output).toEqual([
		{
			path: 'src/components/Button.svelte',
			rule: 'atomic-tier-required',
			message: 'Declare the component composition level with @harness-tier.'
		},
		{
			path: 'src/components/Button.svelte',
			rule: 'atomic-native-element',
			message: 'Use the shared atom for div.'
		}
	]);
	const route = run('src/routes/+page.svelte', '<div>Save</div>');
	expect(route.output.map((finding) => finding.rule)).toEqual([
		'atomic-tier-required',
		'atomic-native-element'
	]);

	recordExampleCases(meta(state), [
		{ name: 'reports a native div in a component', ...component },
		{ name: 'reports a native div in a route', ...route }
	]);
});

test('Allows shared hx elements and still requires a tier', () => {
	const state = 'allows-shared-hx-elements-and-still-requires-a-tier';
	const shared = run('src/components/Button.svelte', '<hx-button>Save</hx-button>');
	expect(shared.output.map((finding) => finding.rule)).toEqual([
		'atomic-tier-required',
		'atomic-definition-required'
	]);

	recordExampleCases(meta(state), [{ name: 'allows an hx-button element', ...shared }]);
});
