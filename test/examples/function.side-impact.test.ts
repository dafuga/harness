import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { defaultUnitsConfig } from '../../src/core/unitsConfig';
import type { ImpactReport, ImpactSide } from '../../src/core/development-tooling/impactTypes';
import type { SourceGraph } from '../../src/core/development-tooling/sourceTypes';
import {
	impactView,
	sideImpact,
	storedSide,
	type StoredSide
} from '../../src/utils/explorer-ui/sideImpact';

const unitId = 'function.side-impact';
const source = 'src/utils/explorer-ui/sideImpact.ts';
const head = 'b'.repeat(40);
const base = 'a'.repeat(40);
const unit = { id: unitId, status: 'active', source: [source] };

/** A stored side tracking one source file under the given content hash. */
function storedWith(hash: string): StoredSide {
	return {
		schemaVersion: 1,
		config: defaultUnitsConfig,
		files: [[source, hash]],
		units: [unit],
		scenarios: [],
		nodes: [[source, 'source']],
		edges: [],
		uncertain: []
	};
}

/** Two known nodes, one edge between them and one edge that points at a node never listed. */
function graphWithDanglingEdge(): SourceGraph {
	return {
		nodes: [
			{ id: 'src/a.ts', kind: 'source' },
			{ id: 'src/b.ts', kind: 'source' }
		],
		edges: [
			{ from: 'src/a.ts', to: 'src/b.ts', via: '' },
			{ from: 'src/a.ts', to: 'src/missing.ts', via: '' }
		],
		uncertain: []
	};
}

function sideWith(graph: SourceGraph): ImpactSide {
	return {
		revision: head,
		config: defaultUnitsConfig,
		entries: [],
		manifests: [],
		scenarios: [],
		graph
	};
}

const report: ImpactReport = {
	base,
	head,
	runtime: 'module',
	expanded: false,
	changed: [{ path: source, status: 'modified', classification: 'source', unit: unitId }],
	units: { direct: [unitId], indirect: [], added: [], removed: [] },
	tests: { selected: [], excluded: [], removed: [] },
	scenarios: { affected: ['titles-page'], unaffected: ['titles-audio'] },
	uncertain: []
};

test('a head with no earlier side reports its source file as added', async () => {
	const headSide = { commit: head, side: storedWith('1'.repeat(40)) };
	const result = await sideImpact(null, headSide);
	expect(result).toEqual({
		base: null,
		expanded: false,
		units: { direct: [], indirect: [], added: [], removed: [] },
		scenarios: [],
		uncertain: [],
		changed: [{ path: source, status: 'added', classification: 'source', unit: unitId }]
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'sideImpact',
			state: 'side-impact-no-history-side',
			evidence: 'examples-cases',
			file: 'side-impact-no-history-side.json'
		},
		[
			{
				name: 'head side with no earlier side is added',
				input: { base: null, head: headSide },
				output: result
			}
		]
	);
});

test('a changed file hash between two stored sides reports it as modified', async () => {
	const baseSide = { commit: base, side: storedWith('1'.repeat(40)) };
	const headSide = { commit: head, side: storedWith('2'.repeat(40)) };
	const result = await sideImpact(baseSide, headSide);
	expect(result.base).toBe(base);
	expect(result.changed).toEqual([
		{ path: source, status: 'modified', classification: 'source', unit: unitId }
	]);
	expect(result.expanded).toBe(false);
	recordExampleCases(
		{
			unitId,
			symbol: 'sideImpact',
			state: 'side-impact-stored-sides-modified',
			evidence: 'examples-cases',
			file: 'side-impact-stored-sides-modified.json'
		},
		[
			{
				name: 'changed file hash between stored sides is modified',
				input: { base: baseSide, head: headSide },
				output: result
			}
		]
	);
});

test('an edge whose target is not a listed node rejects with a TypeError', async () => {
	const side = { ...storedWith('1'.repeat(40)), edges: [[0, 5] as [number, number]] };
	const input = { base: null, head: { commit: head, side } };
	let error: unknown;
	try {
		await sideImpact(null, input.head);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(TypeError);
	recordExampleCases(
		{
			unitId,
			symbol: 'sideImpact',
			state: 'side-impact-dangling-edge-rejects',
			evidence: 'examples-cases',
			file: 'side-impact-dangling-edge-rejects.json'
		},
		[
			{
				name: 'stored edge index past the node list rejects with TypeError',
				input,
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]
	);
});

test('storedSide keeps edges between listed nodes and omits the rest', () => {
	const input = sideWith(graphWithDanglingEdge());
	const result = storedSide(input);
	expect(result.edges).toEqual([[0, 1]]);
	expect(result.nodes).toEqual([
		['src/a.ts', 'source'],
		['src/b.ts', 'source']
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'storedSide',
			state: 'stored-side-omits-missing-edges',
			evidence: 'examples-cases',
			file: 'stored-side-omits-missing-edges.json'
		},
		[{ name: 'edge to an unlisted node is omitted from stored edges', input, output: result }]
	);
});

test('impactView keeps only affected scenarios and copies the base', () => {
	const result = impactView(report, base);
	expect(result).toEqual({
		base,
		expanded: false,
		units: report.units,
		scenarios: ['titles-page'],
		uncertain: [],
		changed: report.changed
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'impactView',
			state: 'impact-view-keeps-affected-scenarios',
			evidence: 'examples-cases',
			file: 'impact-view-keeps-affected-scenarios.json'
		},
		[
			{
				name: 'unaffected scenarios are dropped and base is copied',
				input: { report, base },
				output: result
			}
		]
	);
});
