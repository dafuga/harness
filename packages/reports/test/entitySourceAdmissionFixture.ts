import { measureWorkload } from '../../../test/support/measureWorkload';
import { render } from 'svelte/server';
import { expect } from 'vitest';
import { words } from './entityRender';
import EntitySource, { archivedSource } from '../src/components/explorer-ui/EntitySource.svelte';
import type { HarnessUnit } from '../src/models/Harness.types';

/** Arrays admitted before JSON retain indexed values without using their iterator or species. */
export function sourceAdmissionArrays(unit: HarnessUnit) {
	const paths = [...unit.owns.source];
	const tests = [{ path: 'test/order-store.test.ts', media: null, gap: 'Recorded test gap' }];
	const snapshots = paths.map((path) => ({
		path,
		media: null,
		gap: 'Recorded implementation gap'
	}));
	const reads = { indexed: 0, iterated: 0, species: 0 };
	for (const input of [paths, tests, snapshots]) {
		const first = input[0];
		Object.defineProperty(input, '0', {
			get() {
				reads.indexed++;
				return first;
			}
		});
		Object.defineProperty(input, Symbol.iterator, {
			value() {
				reads.iterated++;
				return [][Symbol.iterator]();
			}
		});
		Object.defineProperty(input, 'constructor', {
			value: {
				get [Symbol.species]() {
					reads.species++;
					return Array;
				}
			}
		});
	}
	return { paths, tests, snapshots, reads };
}

/** Exercise archived source admission without replaying its normal assertions. */
export async function sourceAdmission(unit: HarnessUnit): Promise<void> {
	await measureWorkload('reports.store.source-reader', 'archived-source-admission', async () => {
		const { paths, tests, snapshots, reads } = sourceAdmissionArrays(unit);
		const body = render(EntitySource, {
			props: { unit: { ...unit, owns: { ...unit.owns, source: paths }, testFiles: tests } }
		}).body;
		expect(words(body)).toContain('src/services/orders/OrderStore.ts');
		expect(words(body)).toContain('test/order-store.test.ts');
		const beforeRead = reads.indexed;
		const reader = archivedSource({ ...unit, sourceFiles: snapshots, testFiles: tests }, '/media/');
		expect(reads.indexed, 'source readers keep indexed getters lazy until a read').toBe(beforeRead);
		await expect(
			reader.read(paths[0]),
			'indexed source snapshots retain their recorded gap'
		).rejects.toThrow('Recorded implementation gap');
		await expect(reader.read(tests[0].path)).rejects.toThrow('Recorded test gap');
		expect(reads.indexed).toBeGreaterThan(0);
		expect(reads.iterated).toBe(0);
		expect(reads.species).toBe(0);
	});
}
