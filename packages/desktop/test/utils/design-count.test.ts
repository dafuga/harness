import { expect, test } from 'vitest';
import type { RunRequest } from '../../src/models/DesktopBridge.types';
import { designCount } from '../../src/utils/designCount';

/** How many design options a request asks for, and which requests are refused before any work. */
const plan = { mode: 'plan' } as RunRequest;

test('a Plan that states no count makes three options, and a stated count from 1 to 10 is kept', () => {
	expect([
		designCount(plan),
		...[1, 2, 10].map((n) => designCount({ ...plan, designOptions: n }))
	]).toEqual([3, 1, 2, 10]);
});

test('a count that is not a whole number from 1 to 10 is refused', () => {
	for (const designOptions of [0, 11, 2.5, -1, Number.NaN, '3' as unknown as number])
		expect(() => designCount({ ...plan, designOptions })).toThrow('from 1 to 10');
});

test('a Change that asks for design options is refused', () => {
	const change = { ...plan, mode: 'change' } as RunRequest;
	expect(designCount(change)).toBe(3);
	expect(() => designCount({ ...change, designOptions: 1 })).toThrow(
		'A Change makes no design options.'
	);
});
