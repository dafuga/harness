import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { atomicSyntax, walkAtomicMarkup } from '../../src/templates/development-tooling/atomicSyntax';

const unitId = 'template.development-tooling-atomic-syntax';

type Cases = Parameters<typeof recordExampleCases>[1];
type WalkNode = Parameters<typeof walkAtomicMarkup>[0];

const HEADER_SOURCE = `<!-- @harness-atoms forms -->
<!-- @harness-tier molecule -->
<!-- @harness-element field-group -->
<hx-unknown-example label="Name"></hx-unknown-example>
<div><hx-unknown-example></hx-unknown-example></div>
`;

const NO_HEADER_SOURCE = `<!-- @harness-tier widget -->
<p>plain</p>
`;

const BROKEN_SOURCE = '{#if ready}<p>hi</p>';

const SUBTREE = {
	type: 'Root',
	parent: { type: 'Parent' },
	metadata: { type: 'Meta' },
	fragment: {
		type: 'Fragment',
		nodes: [
			{ type: 'Text', data: 'a' },
			{
				type: 'Element',
				attributes: [{ type: 'Attribute' }],
				fragment: { type: 'Fragment' }
			}
		]
	}
};

function summarizeAtoms(source: string) {
	return atomicSyntax(source).atoms.map((atom) => ({
		tag: atom.node.name,
		definition: atom.definition?.tag ?? null
	}));
}

function visitedTypes(node: unknown, callback?: (item: { type: string }) => void): string[] {
	const types: string[] = [];
	walkAtomicMarkup(node as WalkNode, (item: { type: string }) => {
		types.push(item.type);
		callback?.(item);
	});
	return types;
}

function record(symbol: string, state: string, cases: Cases) {
	return recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Reads the harness header comments of a template', () => {
	const result = atomicSyntax(HEADER_SOURCE);
	const summary = {
		directory: result.directory ?? null,
		tier: result.tier ?? null,
		element: result.element ?? null
	};

	expect(summary).toEqual({ directory: 'forms', tier: 'molecule', element: 'field-group' });
	record('atomicSyntax', 'reads-the-harness-header-comments-of-a-template', [
		{
			name: 'template declares atoms directory, tier and element comments',
			input: { content: HEADER_SOURCE },
			output: summary
		}
	]);
});

test('Lists hx- atoms found at any depth of the markup', () => {
	const atoms = summarizeAtoms(HEADER_SOURCE);

	expect(atoms).toEqual([
		{ tag: 'hx-unknown-example', definition: null },
		{ tag: 'hx-unknown-example', definition: null }
	]);
	record('atomicSyntax', 'lists-hx-atoms-found-at-any-depth-of-the-markup', [
		{
			name: 'two hx- elements, one nested in a div, with no native definition',
			input: { content: HEADER_SOURCE },
			output: atoms
		}
	]);
});

test('Leaves headers undefined when no matching comment exists', () => {
	const result = atomicSyntax(NO_HEADER_SOURCE);
	const summary = {
		directory: result.directory ?? null,
		tier: result.tier ?? null,
		element: result.element ?? null,
		atoms: result.atoms.length
	};

	expect(summary).toEqual({ directory: null, tier: null, element: null, atoms: 0 });
	record('atomicSyntax', 'leaves-headers-undefined-when-no-matching-comment-exists', [
		{
			name: 'tier comment with an unknown tier value is ignored',
			input: { content: NO_HEADER_SOURCE },
			output: summary
		}
	]);
});

test('Rejects when the Svelte parser cannot parse the source', () => {
	let error: unknown;
	try {
		atomicSyntax(BROKEN_SOURCE);
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeDefined();
	expect(String((error as Error).message).length).toBeGreaterThan(0);
	record('atomicSyntax', 'rejects-when-the-svelte-parser-cannot-parse-the-source', [
		{
			name: 'unclosed if block passes the parser exception through',
			input: { content: BROKEN_SOURCE },
			error: { name: (error as Error).name, message: (error as Error).message }
		}
	]);
});

test('Walks nested markup and skips parent and attribute keys', () => {
	const types = visitedTypes(SUBTREE);

	expect(types).toEqual(['Root', 'Fragment', 'Text', 'Element', 'Fragment']);
	record('walkAtomicMarkup', 'walks-nested-markup-and-skips-parent-and-attribute-keys', [
		{
			name: 'subtree visits typed nodes in order and skips parent, metadata and attributes',
			input: { node: SUBTREE },
			output: types
		}
	]);
});

test('Propagates an exception thrown by the walker callback', () => {
	let error: unknown;
	try {
		walkAtomicMarkup({ type: 'Text' } as unknown as WalkNode, () => {
			throw new Error('visit failed');
		});
	} catch (caught) {
		error = caught;
	}

	expect((error as Error).message).toBe('visit failed');
	record('walkAtomicMarkup', 'propagates-an-exception-thrown-by-the-walker-callback', [
		{
			name: 'callback error passes through unchanged',
			input: { node: { type: 'Text' } },
			error: { name: (error as Error).name, message: (error as Error).message }
		}
	]);
});
