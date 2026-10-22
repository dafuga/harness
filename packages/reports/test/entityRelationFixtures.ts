import type { HarnessRevision } from '../src/models/Harness.types';
import { relationServiceMetadata, relationSource } from './entityClassFixtures';
import { ids } from './entityUnits';

/** Mixed module groups exceed one and two batches, with an uneven final batch. */
export function withRelationGroups(detail: HarnessRevision): HarnessRevision {
	const kinds = ['page', 'shell', 'component', 'function', 'config', 'service', 'model'];
	const generated = kinds.flatMap((kind) =>
		Array.from({ length: 9 }, (_, offset) => {
			const seed =
				detail.registry.units.find((unit) => unit.kind === kind) ??
				detail.registry.units.find((unit) => unit.id === ids.store)!;
			const id = `consumer.${kind}.${offset + 1}`;
			return {
				...seed,
				id,
				kind,
				title: `Consumer ${kind} ${offset + 1}`,
				...relationServiceMetadata(kind, offset, ids.page),
				helpers:
					kind === 'function'
						? [
								{
									name: `consumerFunction${offset + 1}`,
									source: `src/functions/Consumer${offset + 1}.ts`,
									pure: true,
									inputs: [],
									consumers: [{ unit: ids.list }, { unit: ids.store }]
								}
							]
						: [],
				dependencies: [{ unit: ids.filter, via: 'import' }],
				owns: {
					source: [relationSource(kind, offset)],
					symbols: []
				},
				version: id
			};
		})
	);
	const hosts = detail.registry.units.map((unit) => {
		let dependencies = [] as typeof unit.dependencies;
		if ([ids.list, ids.store].includes(unit.id))
			dependencies = generated
				.filter((item) => item.kind === 'function')
				.map(({ id }) => ({ unit: id, via: 'import' }));
		if (unit.id === ids.page)
			dependencies = generated.map(({ id }) => ({ unit: id, via: 'import' }));
		return { ...unit, dependencies };
	});
	return { ...detail, registry: { ...detail.registry, units: [...hosts, ...generated] } };
}
