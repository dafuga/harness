import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { revision } from './entityFixture';
import { commits, ids } from './entityUnits';
import { withHelpers } from './entityPreviewHelpers';
import { withGroups } from './entityPreviewData';

/** Distinct text makes incorrect commit, selected file and HTML execution observable. */
export function sourceText(commit: string, path: string): string {
	return `// Synthetic committed file: ${path}\nexport const sourceRevision = '${commit}';\n// <script>throw new Error('Source must remain text')</script>\n`;
}

/** All seven kinds retain supported aliases beside category implementations. */
export function sourceCatalog(detail: HarnessRevision): HarnessRevision {
	const added = withGroups(withHelpers(detail));
	return {
		...added,
		registry: {
			...added.registry,
			units: added.registry.units.map((unit) => {
				if (unit.id === ids.filter)
					return {
						...unit,
						owns: {
							...unit.owns,
							source: [
								...new Set([
									...unit.owns.source,
									'src/helpers/orders/filterOrders.ts',
									'src/components/orders/contract.ts'
								])
							]
						},
						helpers: unit.helpers?.map((helper) => ({
							...helper,
							source:
								helper.name === 'filterOrders'
									? 'src/helpers/orders/filterOrders.ts'
									: helper.source
						}))
					};
				return unit.id === ids.store
					? {
							...unit,
							owns: {
								...unit.owns,
								source: [...unit.owns.source, 'src/services/orders/Order types #é.ts']
							}
						}
					: unit;
			})
		}
	};
}

export const sourceTestPath = (id: string): string => `test/${id}.test.ts`;

export const sourcePaths = [
	...new Set(
		sourceCatalog(revision(commits.tip, [])).registry.units.flatMap((unit) => [
			...unit.owns.source,
			sourceTestPath(unit.id)
		])
	)
];

/** The same content-addressed snapshots are served through the normal preview fixture. */
export function sourceSnapshots(detail: HarnessRevision, hashes: Record<string, string>) {
	return {
		...detail,
		registry: {
			...detail.registry,
			units: detail.registry.units.map((unit) => ({
				...unit,
				testFiles: [
					{
						path: sourceTestPath(unit.id),
						media: `media/${hashes[`source:${detail.commit}:${sourceTestPath(unit.id)}`]}.txt`
					}
				],
				...{
					sourceFiles: unit.owns.source.map((path) => ({
						path,
						media: `media/${hashes[`source:${detail.commit}:${path}`]}.txt`
					}))
				}
			}))
		}
	};
}

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
