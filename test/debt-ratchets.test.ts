import { expect, test } from 'vitest';
import { layerRatchet, reuseRatchet } from '../scripts/check-debt-ratchets';

test('layer allowlist permits removals and reports new upward imports', () => {
	const result = layerRatchet(
		[
			{ from: 'src/a.ts', to: 'src/services/b.ts', todo: 'TODO: move' },
			{ from: 'src/c.ts', to: 'src/cli/d.ts', todo: 'TODO: move' }
		],
		[
			{ from: 'src/c.ts', to: 'src/cli/d.ts', todo: 'TODO: move' },
			{ from: 'src/e.ts', to: 'src/workflows/f.ts', todo: 'TODO: move' }
		]
	);
	expect(result).toEqual({
		before: 2,
		after: 2,
		added: ['src/e.ts -> src/workflows/f.ts'],
		removed: ['src/a.ts -> src/services/b.ts']
	});
});

test('reuse baseline permits reductions but reports new paths and higher counts', () => {
	const result = reuseRatchet(
		{ 'a.svelte#card': 2, 'b.svelte#table': 1 },
		{ 'a.svelte#card': 1, 'b.svelte#table': 2, 'c.svelte#pill': 1 }
	);
	expect(result).toEqual({
		before: 3,
		after: 4,
		added: ['b.svelte#table: 1 -> 2', 'c.svelte#pill: 0 -> 1'],
		reduced: ['a.svelte#card: 2 -> 1']
	});
});
