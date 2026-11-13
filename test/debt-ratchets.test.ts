import { expect, test } from 'vitest';
import {
	layerRatchet,
	mkdtempCallCount,
	reuseRatchet,
	temporaryCallRatchet
} from '../scripts/check-debt-ratchets';

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

test('temporary-call ratchet preserves legacy inventory while rejecting new growth', () => {
	const result = temporaryCallRatchet(
		{ 'test/legacy.test.ts': 3, 'test/support/temporary.ts': 0 },
		{
			'test/legacy.test.ts': 2,
			'test/new.test.ts': 1,
			'test/growing.test.ts': 2,
			'test/support/temporary.ts': 1
		}
	);
	expect(result).toEqual({
		before: 3,
		after: 6,
		added: ['test/growing.test.ts: 0 -> 2', 'test/new.test.ts: 0 -> 1']
	});
});

test('temporary-call scanner counts imported aliases and namespace calls, not comments or lookalikes', () => {
	expect(
		mkdtempCallCount(`
			import { mkdtemp as createDirectory } from 'node:fs/promises';
			import * as fs from 'node:fs';
			// mkdtemp() is legacy text, not a call.
			createDirectory('/tmp/a');
			fs.mkdtempSync('/tmp/b');
			other.mkdtemp('/tmp/c');
		`)
	).toBe(2);
});
