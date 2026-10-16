import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'vitest';
import type { ImpactInput, ImpactOutput, KernelGraph } from '../src/core/kernelTypes';
import { kernelClosure } from '../src/utils/kernelClosure';
import { recordCapture } from '../src/utils/recordCapture';
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
type Case = { name: string; input: ImpactInput; expected: ImpactOutput };

/** b depends on a, c on b and the sink t on c. */
const chain: KernelGraph = {
	nodes: ['a', 'b', 'c', 't'],
	edges: [
		[1, 0],
		[2, 1],
		[3, 2]
	]
};
/** app depends on old and on lib; in head old is gone and app depends on lib alone. */
const withOld: KernelGraph = {
	nodes: ['lib', 'app', 'old'],
	edges: [
		[1, 2],
		[1, 0]
	]
};
const withoutOld: KernelGraph = { nodes: ['lib', 'app'], edges: [[1, 0]] };
/** The sink t depends on y; nothing depends on x and x depends on nothing. */
const apart: KernelGraph = { nodes: ['x', 'y', 't'], edges: [[2, 1]] };
/** api depends on cfg, the sink t on api and on core. */
const layered: KernelGraph = {
	nodes: ['cfg', 'api', 'core', 't'],
	edges: [
		[1, 0],
		[3, 1],
		[3, 2]
	]
};
/** The same graph with new, added in head, depending on api. */
const extended: KernelGraph = {
	nodes: ['cfg', 'api', 'core', 't', 'new'],
	edges: [
		[1, 0],
		[3, 1],
		[3, 2],
		[4, 1]
	]
};

const cases: Case[] = [
	{
		name: 'a changed seed reaches its dependents one, two and three hops away in both graphs',
		input: { base: chain, head: chain, changed: ['a'], uncertain: [], sinks: ['t'] },
		expected: {
			affected: [
				{ id: 'a', distance: 0, via: 'both', presence: 'both', seed: 'changed' },
				{ id: 'b', distance: 1, via: 'both', presence: 'both', seed: null },
				{ id: 'c', distance: 2, via: 'both', presence: 'both', seed: null },
				{ id: 't', distance: 3, via: 'both', presence: 'both', seed: null }
			],
			uncovered: [],
			unknown: []
		}
	},
	{
		name: 'a removed seed follows the head nodes; its surviving dependent is reached through base',
		input: {
			base: withOld,
			head: withoutOld,
			changed: ['old'],
			uncertain: [],
			sinks: ['app']
		},
		expected: {
			affected: [
				{ id: 'app', distance: 1, via: 'base', presence: 'both', seed: null },
				{ id: 'old', distance: 0, via: 'base', presence: 'removed', seed: 'changed' }
			],
			uncovered: [],
			unknown: []
		}
	},
	{
		name: 'a changed id no sink depends on is uncovered; one in neither graph is unknown',
		input: { base: apart, head: apart, changed: ['x', 'ghost'], uncertain: [], sinks: ['t'] },
		expected: {
			affected: [{ id: 'x', distance: 0, via: 'both', presence: 'both', seed: 'changed' }],
			uncovered: ['x'],
			unknown: ['ghost']
		}
	},
	{
		name: 'an uncertain id seeds its dependents beside a changed seed, up to a node added in head',
		input: {
			base: layered,
			head: extended,
			changed: ['core'],
			uncertain: ['cfg'],
			sinks: ['t']
		},
		expected: {
			affected: [
				{ id: 'cfg', distance: 0, via: 'both', presence: 'both', seed: 'uncertain' },
				{ id: 'api', distance: 1, via: 'both', presence: 'both', seed: null },
				{ id: 'core', distance: 0, via: 'both', presence: 'both', seed: 'changed' },
				{ id: 't', distance: 1, via: 'both', presence: 'both', seed: null },
				{ id: 'new', distance: 2, via: 'head', presence: 'added', seed: null }
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
