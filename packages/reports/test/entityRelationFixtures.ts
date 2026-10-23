import type { HarnessRevision } from '../src/models/Harness.types';
import { relationServiceMetadata, relationSource, modelDefinition } from './entityClassFixtures';
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

/** Mixed consumer kinds, duplicates and a fourth eligible consumer exercise every card's limit. */
export function withConsumers(detail: HarnessRevision): HarnessRevision {
	const model = {
		...detail.registry.units.find((unit) => unit.id === ids.store)!,
		id: 'app.model.order',
		kind: 'model',
		title: 'Order',
		owns: {
			source: ['src/models/Order.ts', 'src/models/Order.types.ts'],
			symbols: ['Order']
		},
		modelDefinitions: [modelDefinition('Order', 'src/models/Order.ts')]
	};
	const secondModel = {
		...model,
		id: 'app.model.invoice',
		title: 'Invoice',
		owns: { source: ['src/models/Invoice.ts'], symbols: ['Invoice'] },
		modelDefinitions: [modelDefinition('Invoice', 'src/models/Invoice.ts')]
	};
	const types = {
		...model,
		id: 'app.model.order-input',
		title: 'OrderInput',
		owns: {
			source: ['src/models/OrderInput.types.ts', 'src/models/OrderInputValues.ts'],
			symbols: ['OrderInput']
		},
		modelDefinitions: [modelDefinition('OrderInput', 'src/models/OrderInput.types.ts')]
	};
	const consumers = [
		ids.page,
		ids.filter,
		'missing',
		ids.list,
		ids.list,
		ids.store,
		model.id,
		ids.card
	].map((unit) => ({ unit }));
	return {
		...detail,
		registry: {
			...detail.registry,
			units: [
				...detail.registry.units.map((unit) => {
					if (unit.id === ids.filter)
						return { ...unit, helpers: unit.helpers?.map((helper) => ({ ...helper, consumers })) };
					if (unit.id === ids.list || unit.id === ids.store)
						return {
							...unit,
							dependencies: [
								...unit.dependencies,
								{ unit: model.id, via: 'import' },
								{ unit: secondModel.id, via: 'import' },
								{ unit: types.id, via: 'type-import' },
								...(unit.id === ids.store ? [{ unit: ids.card, via: 'import' }] : [])
							]
						};
					return unit;
				}),
				model,
				secondModel,
				types
			]
		}
	};
}
