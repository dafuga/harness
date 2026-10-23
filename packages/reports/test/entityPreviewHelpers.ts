import type { HarnessRevision } from '../src/models/Harness.types';
import { ids } from './entityUnits';
import { serviceClassProof } from './entityClassFixtures';

const helperUsers: Record<string, Array<{ unit: string; symbol?: string }>> = {
	'no-visible': [{ unit: 'missing' }, { unit: 'function.no-visible' }],
	'single-visible': [{ unit: ids.list }, { unit: 'function.single-visible' }],
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
	detail = withServices(withConsumers(detail));
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
			owns: { source: [`src/utils/${kind}.ts`], symbols: [kind] },
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
		owns: {
			source: ['src/models/Order.types.ts', 'src/models/OrderValues.ts'],
			symbols: ['OrderInput', 'OrderResult', 'orderStatuses']
		}
	};
	const secondModel = {
		...model,
		id: 'app.model.invoice',
		title: 'Invoice',
		owns: { source: ['src/models/Invoice.ts'], symbols: ['Invoice'] }
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
								...(unit.id === ids.store ? [{ unit: ids.card, via: 'import' }] : [])
							]
						};
					return unit;
				}),
				model,
				secondModel
			]
		}
	};
}

/** Private services stay linked to their owners but never enter the shared catalog. */
function withServices(detail: HarnessRevision): HarnessRevision {
	const template = detail.registry.units.find((unit) => unit.id === ids.store)!;
	const variants = privateServiceUsers;
	return {
		...detail,
		registry: {
			...detail.registry,
			units: [
				...detail.registry.units,
				{
					...template,
					id: 'app.workflow.record-analytics',
					kind: 'workflow',
					title: 'Analytics recording',
					owns: {
						source: ['src/workflows/recordAnalytics.ts'],
						symbols: ['AnalyticsInput', 'recordAnalytics']
					},
					serviceConsumers: [{ unit: ids.list }, { unit: ids.store }],
					...{ serviceClasses: [] }
				},
				...variants.map((serviceConsumers, index) => ({
					...template,
					id: `app.service.private-${index}`,
					title: `Private${index}`,
					serviceConsumers,
					...{
						serviceClasses: [
							serviceClassProof(
								`Private${index}`,
								`src/components/order-list/Private${index}.ts`,
								serviceConsumers ?? []
							)
						]
					},
					owns: {
						source: [`src/components/order-list/Private${index}.ts`],
						symbols: [`Private${index}`]
					}
				}))
			]
		}
	};
}

export const privateServiceUsers = [
	[],
	[{ unit: ids.list }],
	[{ unit: ids.list }, { unit: ids.list }],
	[{ unit: ids.list }, { unit: 'missing' }],
	undefined
];

/** Actual named callers may be private functions, including siblings in the helper's unit. */
export function withNamedConsumers(detail: HarnessRevision, sameOwner = false): HarnessRevision {
	const template = detail.registry.units.find((unit) => unit.id === ids.filter)!;
	const ownerId = sameOwner ? ids.filter : 'function.named-users';
	const source = 'src/functions/namedUsers.ts';
	const names = ['firstCall', 'secondCall', 'thirdCall', 'fourthCall'];
	const consumers = names.map((symbol) => ({ unit: ownerId, symbol }));
	const helper = { ...template.helpers![0], consumers };
	const owner = {
		...template,
		id: ownerId,
		title: 'namedUsers',
		...(sameOwner ? {} : { catalog: { visibility: 'internal' as const } }),
		owns: { source: [...template.owns.source, source], symbols: [...names, 'filterOrders'] },
		helpers: [
			...(sameOwner ? [helper] : []),
			...names.map((name) => ({ ...helper, name, source, pure: false, consumers: [] }))
		]
	};
	const target = sameOwner ? owner : { ...template, helpers: [helper] };
	return {
		...detail,
		registry: {
			...detail.registry,
			units: [
				...detail.registry.units.map((unit) => (unit.id === ids.filter ? target : unit)),
				...(sameOwner ? [] : [owner])
			]
		}
	};
}
