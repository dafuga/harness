import { expect } from 'vitest';
import { mapContracts } from '../../src/commands/development-tooling/contracts-command/mapContracts';
import { contractUnit } from './contractsProject';
import { measureWorkload } from './measureWorkload';

/** Direct callable admission accepts getters, own iterators and array species; file JSON cannot. */
export async function assertLinearContractMap(): Promise<void> {
	const counts = { reads: 0, iterations: 0, species: 0 };
	const ids = ['service.root', 'service.branch', 'service.leaf', 'service.end'];
	const entries = ids.map((id, index) => {
		const manifest = contractUnit(
			id,
			`src/${id}.ts`,
			ids[index + 1] ? Array(6).fill(ids[index + 1]) : []
		);
		observeDependencies(manifest, counts);
		return {
			id,
			title: id,
			kind: 'service',
			path: manifest.owns.source[0],
			contractPath: `specification/units/${id}.json`,
			responsibility: manifest.responsibility,
			manifest,
			states: []
		};
	});
	const result = await measureWorkload(
		'command.development-tooling-contracts-command-map-contracts',
		'duplicate-edge-depth-ten-with-admitted-getters-and-species',
		() => mapContracts(entries, [entries[0]], ids[0], 10)
	);
	expect(result.dependencies.map((entry) => entry.id)).toEqual(ids.slice(1).sort());
	expect(result.dependents).toEqual([]);
	expect(counts.reads, 'dependency reads stay linear in distinct contracts').toBeLessThanOrEqual(
		entries.length * 2
	);
	expect(counts.iterations, 'the reverse index retains admitted dependency iterators').toBe(
		entries.length
	);
	expect(counts.species, 'each visited dependency array retains its admitted species').toBe(
		entries.length
	);
}

function observeDependencies(
	manifest: ReturnType<typeof contractUnit>,
	counts: { reads: number; iterations: number; species: number }
): void {
	const dependencies = manifest.dependencies;
	Object.defineProperty(dependencies, Symbol.iterator, {
		value() {
			counts.iterations++;
			return Array.prototype[Symbol.iterator].call(this);
		}
	});
	Object.defineProperty(dependencies, 'constructor', {
		value: {
			get [Symbol.species]() {
				counts.species++;
				return Array;
			}
		}
	});
	Object.defineProperty(manifest, 'dependencies', {
		get() {
			counts.reads++;
			return dependencies;
		}
	});
}
