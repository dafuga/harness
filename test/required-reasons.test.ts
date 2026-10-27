import { expect, test } from 'vitest';
import { requiredReasons } from '../src/utils/requiredReasons';
import { indexFiles, unitOf } from './support/memoryTree';
import { measureWorkload } from './support/measureWorkload';

test('reason comparisons preserve admitted in-memory manifest inputs', async () => {
	const path = 'src/utils/rank.ts';
	const indexed = await indexFiles({
		[path]: 'export function rank(value: number) { return value; }\n'
	});
	const unit = unitOf(indexed, 'function.rank');
	const plain = {
		...unit,
		responsibilityOrigin: 'declared' as const,
		responsibility: 'Ranks values.'
	};
	const reads = { iterator: 0, species: 0, path: 0, contract: 0, runtime: 0 };
	class SourcePaths extends Array<string> {
		static get [Symbol.species]() {
			reads.species++;
			return Array;
		}
	}
	const source = new SourcePaths(path);
	Object.defineProperty(source, '0', {
		configurable: true,
		enumerable: true,
		get: () => {
			reads.path++;
			return path;
		}
	});
	Object.defineProperty(source, Symbol.iterator, {
		value(this: string[]) {
			reads.iterator++;
			return Array.prototype[Symbol.iterator].call(this);
		}
	});
	const observed = {
		...plain,
		owns: { ...plain.owns, source },
		get contract() {
			reads.contract++;
			return plain.contract;
		},
		get runtime() {
			reads.runtime++;
			return plain.runtime;
		}
	};
	const empty = { index: { files: new Map() }, manifests: [] };
	const base = { index: indexed.index, manifests: [unit] };
	const side = (manifest: typeof plain) => ({ index: indexed.index, manifests: [manifest] });
	const expected = [requiredReasons(empty, side(plain)), requiredReasons(base, side(plain))];
	const actual = await measureWorkload(
		'function.required-reasons',
		'compare-in-memory-manifests',
		() => [requiredReasons(empty, side(observed)), requiredReasons(base, side(observed))]
	);
	expect(actual).toEqual(expected);
	for (const count of Object.values(reads)) expect(count).toBeGreaterThan(0);
});
