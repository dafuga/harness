import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { atomicSyntax, walkAtomicMarkup } from '../../src/templates/development-tooling/atomicSyntax';

test('Reads atomic scaffold metadata', () => {
	const result = atomicSyntax(
		'<!-- @harness-atoms src/atoms/button -->\n<!-- @harness-tier atom -->\n<!-- @harness-element button -->\n<hx-button>Save</hx-button>'
	);
	expect(result.directory).toBe('src/atoms/button');
	expect(result.tier).toBe('atom');
	expect(result.element).toBe('button');
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-syntax-d',
			symbol: 'atomicSyntax',
			state: 'reads-atomic-scaffold-metadata',
			evidence: 'examples-cases',
			file: 'reads-atomic-scaffold-metadata.json'
		},
		[{ name: 'reads directory, tier and element from top-level comments', input: { content: '<!-- @harness-atoms src/atoms/button --><!-- @harness-tier atom --><!-- @harness-element button --><hx-button>Save</hx-button>' }, output: { directory: result.directory, tier: result.tier, element: result.element, atomNames: result.atoms.map(({ node }) => node.name) } }]
	);
});

test('Collects matching atomic elements', () => {
	const result = atomicSyntax('<hx-input-checkbox></hx-input-checkbox><div>Text</div>');
	expect(result.atoms).toHaveLength(1);
	expect(result.atoms[0]?.definition?.type).toBe('checkbox');
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-syntax-d',
			symbol: 'atomicSyntax',
			state: 'collects-matching-atomic-elements',
			evidence: 'examples-cases',
			file: 'collects-matching-atomic-elements.json'
		},
		[{ name: 'collects hx elements and resolves the checkbox definition', input: { content: '<hx-input-checkbox></hx-input-checkbox><div>Text</div>' }, output: { atomNames: result.atoms.map(({ node }) => node.name), definitions: result.atoms.map(({ definition }) => definition) } }]
	);
});

test('Walks markup nodes in order', () => {
	const visited: string[] = [];
	walkAtomicMarkup({ type: 'Fragment', nodes: [{ type: 'Text', data: 'Save' }, { type: 'Comment', data: ' @harness-element button ' }] } as never, (node) => visited.push(node.type));
	expect(visited).toEqual(['Fragment', 'Text', 'Comment']);
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-syntax-d',
			symbol: 'walkAtomicMarkup',
			state: 'walks-markup-nodes-in-order',
			evidence: 'examples-cases',
			file: 'walks-markup-nodes-in-order.json'
		},
		[{ name: 'visits fragment and child nodes depth first', input: { type: 'Fragment', nodes: [{ type: 'Text', data: 'Save' }, { type: 'Comment', data: ' @harness-element button ' }] }, output: visited }]
	);
});

test('Ignores excluded markup properties', () => {
	const visited: string[] = [];
	const node = { type: 'Fragment', expression: { type: 'Hidden' }, nodes: [{ type: 'Text', data: 'Visible' }] };
	walkAtomicMarkup(node as never, (entry) => visited.push(entry.type));
	expect(visited).not.toContain('Hidden');
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-syntax-d',
			symbol: 'walkAtomicMarkup',
			state: 'ignores-excluded-markup-properties',
			evidence: 'examples-cases',
			file: 'ignores-excluded-markup-properties.json'
		},
		[{ name: 'skips expression while traversing visible children', input: node, output: visited }]
	);
});

test('Throws a parse error for invalid Svelte source', () => {
	let error: unknown;
	try {
		atomicSyntax('<div>');
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toContain('was left open');
	recordExampleCases(
		{
			unitId: 'template.development-tooling-atomic-syntax-d',
			symbol: 'atomicSyntax',
			state: 'throws-a-parse-error-for-invalid-svelte-source',
			evidence: 'examples-cases',
			file: 'throws-a-parse-error-for-invalid-svelte-source.json'
		},
		[{ name: 'propagates the Svelte parser error unchanged', input: { content: '<div>' }, error: { name: (error as Error).name, message: (error as Error).message } }]
	);
});
