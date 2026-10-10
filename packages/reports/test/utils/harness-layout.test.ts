import { expect, test } from 'vitest';
import type { HarnessUnit } from '../../src/models/Harness.types';
import { harnessLayout, nodeSize } from '../../src/utils/harnessLayout';

function unit(id: string, dependencies: Array<[string, string]> = []): HarnessUnit {
	return {
		id,
		kind: 'function',
		status: 'active',
		title: id,
		responsibility: `Owns ${id}.`,
		dependencies: dependencies.map(([target, via]) => ({ unit: target, via })),
		scenarios: [],
		owns: { source: [], symbols: [] },
		contract: { inputs: [], outputs: [], errors: [] },
		runtime: { kind: 'module', targets: [] },
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] },
		version: '0'.repeat(16)
	};
}

test('two dependencies on the same unit draw one edge', () => {
	const layout = harnessLayout([
		unit('function.kernel-artifacts', [
			['kernel.impact', 'import'],
			['kernel.impact', 'contract']
		]),
		unit('kernel.impact')
	]);
	expect(layout.edges.map((edge) => `${edge.from}>${edge.to}`)).toEqual([
		'function.kernel-artifacts>kernel.impact'
	]);
});

test('foundations sit below their dependents, and wide layers wrap', () => {
	const leaves = Array.from({ length: 14 }, (_, index) =>
		unit(`function.leaf-${String(index).padStart(2, '0')}`)
	);
	const top = unit(
		'service.top',
		leaves.map((leaf) => [leaf.id, 'import'])
	);
	const layout = harnessLayout([...leaves, top]);
	const at = new Map(layout.nodes.map((node) => [node.unit.id, node]));
	const rows = new Set(leaves.map((leaf) => at.get(leaf.id)?.y));
	expect(rows.size).toBe(3);
	expect(Math.max(...[...rows].map(Number))).toBeGreaterThan(at.get('service.top')?.y ?? 0);
	expect(layout.width).toBe(6 * (nodeSize.width + nodeSize.gapX) - nodeSize.gapX);
	// The same units always give the same picture.
	expect(harnessLayout([top, ...leaves.reverse()]).nodes).toEqual(layout.nodes);
});

test('a dependency cycle is laid out instead of looping for ever', () => {
	const layout = harnessLayout([
		unit('function.a', [['function.b', 'import']]),
		unit('function.b', [['function.a', 'import']])
	]);
	expect(layout.nodes).toHaveLength(2);
	expect(layout.edges).toHaveLength(2);
});
