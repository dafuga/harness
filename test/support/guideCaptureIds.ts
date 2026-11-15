import { expect } from 'vitest';

export function assertGuideCaptureIds(states: Array<{ name: string }>) {
	const names = states.map((state) => state.name);
	expect(
		names.every((name) => /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(name)),
		'inferred prop boundaries must be valid lowercase capture identifiers'
	).toBe(true);
	expect(names).toEqual(
		expect.arrayContaining([
			'empty-asset-base',
			'without-initial-flags',
			'with-initial-flags',
			'initial-flags-none',
			'initial-flags-one',
			'initial-flags-many'
		])
	);
}
