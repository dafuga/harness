import type { Case } from './kernel-closure-capture.test.types';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';
import type { KernelGraph } from '../src/core/kernelTypes';
import { kernelClosure } from '../src/utils/impact-kernel/kernelClosure';
import { recordCapture } from '../src/utils/record-capture/recordCapture';
import { expect } from './verificationExpect';

/**
 * The real kernelClosure, called with four small graphs written as ordinary JSON. Each answer is
 * asserted against the closure worked out by hand below; only when every one holds are the calls
 * recorded, each as its input and what kernelClosure returned, never what was expected. Nothing
 * is written unless the run opted into evidence. These calls cover ordinary JSON input only:
 * arrays with their own iterators, species or custom mapped iterators are held by the guards of
 * test/utils/impact-kernel.test.ts, not here.
 */
const root = resolve(import.meta.dirname, '..');
const source = 'src/utils/kernelClosure.ts';

/** The label uses the formatter, the page uses the label, and the test uses the page. */
const chain: KernelGraph = {
	nodes: ['Price formatter', 'Price label', 'Product page', 'Page test'],
	edges: [
		[1, 0],
		[2, 1],
		[3, 2]
	]
};
/** The app uses a shared library and a helper that the next version removes. */
const withOld: KernelGraph = {
	nodes: ['Shared library', 'App', 'Removed helper'],
	edges: [
		[1, 2],
		[1, 0]
	]
};
const withoutOld: KernelGraph = { nodes: ['Shared library', 'App'], edges: [[1, 0]] };
/** The page test uses page data; the untested helper has no connections. */
const apart: KernelGraph = {
	nodes: ['Untested helper', 'Page data', 'Page test'],
	edges: [[2, 1]]
};
/** The API uses settings; the page test uses the API and shared core. */
const layered: KernelGraph = {
	nodes: ['Settings', 'API', 'Shared core', 'Page test'],
	edges: [
		[1, 0],
		[3, 1],
		[3, 2]
	]
};
/** The same dependencies, with a new page that also uses the API. */
const extended: KernelGraph = {
	nodes: ['Settings', 'API', 'Shared core', 'Page test', 'New page'],
	edges: [
		[1, 0],
		[3, 1],
		[3, 2],
		[4, 1]
	]
};

const cases: Case[] = [
	{
		name: 'Changing the price formatter affects its label, product page and page test',
		input: {
			base: chain,
			head: chain,
			changed: ['Price formatter'],
			uncertain: [],
			sinks: ['Page test']
		},
		expected: {
			affected: [
				{ id: 'Price formatter', distance: 0, via: 'both', presence: 'both', seed: 'changed' },
				{ id: 'Price label', distance: 1, via: 'both', presence: 'both', seed: null },
				{ id: 'Product page', distance: 2, via: 'both', presence: 'both', seed: null },
				{ id: 'Page test', distance: 3, via: 'both', presence: 'both', seed: null }
			],
			uncovered: [],
			unknown: []
		}
	},
	{
		name: 'Removing a helper still affects the app that used it',
		input: {
			base: withOld,
			head: withoutOld,
			changed: ['Removed helper'],
			uncertain: [],
			sinks: ['App']
		},
		expected: {
			affected: [
				{ id: 'App', distance: 1, via: 'base', presence: 'both', seed: null },
				{ id: 'Removed helper', distance: 0, via: 'base', presence: 'removed', seed: 'changed' }
			],
			uncovered: [],
			unknown: []
		}
	},
	{
		name: 'An untested helper has no coverage; a missing unit cannot be located',
		input: {
			base: apart,
			head: apart,
			changed: ['Untested helper', 'Missing unit'],
			uncertain: [],
			sinks: ['Page test']
		},
		expected: {
			affected: [
				{ id: 'Untested helper', distance: 0, via: 'both', presence: 'both', seed: 'changed' }
			],
			uncovered: ['Untested helper'],
			unknown: ['Missing unit']
		}
	},
	{
		name: 'Uncertain settings also affect the API, page test and newly added page',
		input: {
			base: layered,
			head: extended,
			changed: ['Shared core'],
			uncertain: ['Settings'],
			sinks: ['Page test']
		},
		expected: {
			affected: [
				{ id: 'Settings', distance: 0, via: 'both', presence: 'both', seed: 'uncertain' },
				{ id: 'API', distance: 1, via: 'both', presence: 'both', seed: null },
				{ id: 'Shared core', distance: 0, via: 'both', presence: 'both', seed: 'changed' },
				{ id: 'Page test', distance: 1, via: 'both', presence: 'both', seed: null },
				{ id: 'New page', distance: 2, via: 'head', presence: 'added', seed: null }
			],
			uncovered: [],
			unknown: []
		}
	}
];

test('kernelClosure returns the closure worked out for four ordinary JSON graphs; only then are its calls recorded', () => {
	const calls = cases.map(({ name, input }) => ({ name, input, output: kernelClosure(input) }));
	cases.forEach((item, at) => expect(calls[at].output, item.name).toEqual(item.expected));
	expect(new Set(calls.map((call) => JSON.stringify(call.input))).size).toBe(cases.length);
	// What is recorded reads back as the very input given and the very output returned.
	expect(JSON.parse(JSON.stringify(calls))).toEqual(calls);
	const bytes = readFileSync(join(root, source));
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	const document = {
		schemaVersion: 1,
		kind: 'function-invocations',
		unitId: 'function.kernel-closure',
		symbol: 'kernelClosure',
		source: { path: source, sha256 },
		cases: calls
	};
	recordCapture(
		{
			evidence: 'calls',
			kind: 'assertions',
			state: 'ordinary-json',
			file: 'kernel-closure-cases.json',
			mediaType: 'application/json'
		},
		JSON.stringify(document, null, '\t')
	);
});
