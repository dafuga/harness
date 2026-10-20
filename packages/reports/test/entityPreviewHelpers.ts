import type { HarnessRevision } from '../src/models/Harness.types';
import { ids } from './entityUnits';

const helperUsers: Record<string, Array<{ unit: string; symbol?: string }>> = {
	'no-visible': [{ unit: ids.page }, { unit: ids.filter }],
	'single-visible': [{ unit: ids.list }, { unit: ids.filter }],
	unresolved: [{ unit: ids.list }, { unit: 'missing' }],
	'same-owner-functions': [
		{ unit: ids.list, symbol: 'first' },
		{ unit: ids.list, symbol: 'second' }
	],
	unused: [],
	single: [{ unit: ids.list }],
	effectful: [{ unit: ids.list }, { unit: ids.store }],
	duplicates: [{ unit: ids.list }, { unit: ids.list }]
};

/** Source-derived helper metadata distinguishes callable utilities from implementation units. */
export function withHelpers(detail: HarnessRevision): HarnessRevision {
	detail = withConsumers(detail);
	const template = detail.registry.units.find((unit) => unit.id === ids.filter)!;
	const hidden = [
		'no-visible',
		'single-visible',
		'unresolved',
		'same-owner-functions',
		'types',
		'schema',
		'private',
		'class-method',
		'legacy',
		'unused',
		'single',
		'effectful',
		'duplicates'
	].map((kind) => {
		let helpers: typeof template.helpers = kind === 'legacy' ? undefined : [];
		const consumers = helperUsers[kind];
		if (consumers) {
			helpers = template.helpers?.map((helper) => ({
				...helper,
				name: kind,
				pure: kind !== 'effectful',
				consumers
			}));
		}
		return {
			...template,
			id: `function.${kind}`,
			title: kind,
			helpers
		};
	});
	return {
		...detail,
		registry: {
			...detail.registry,
			units: [
				...detail.registry.units.map((unit) =>
					unit.id === ids.list
						? {
								...unit,
								dependencies: [...unit.dependencies, { unit: 'function.single', via: 'import' }]
							}
						: unit
				),
				...hidden
			]
		}
	};
}

/** Mixed consumer kinds, duplicates and a fourth eligible consumer exercise every card's limit. */
function withConsumers(detail: HarnessRevision): HarnessRevision {
	const model = {
		...detail.registry.units.find((unit) => unit.id === ids.store)!,
		id: 'app.model.order',
		kind: 'model',
		title: 'Order',
		owns: { source: ['src/models/Order.ts'], symbols: ['Order'] }
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
							dependencies: [...unit.dependencies, { unit: model.id, via: 'import' }]
						};
					return unit;
				}),
				model
			]
		}
	};
}
