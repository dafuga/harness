import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { ids, units } from './entityUnits';

/** A relocation retains a supported forwarding entry beside the real category source. */
function categoryUnit(unit: HarnessUnit, commit: string): HarnessUnit {
	const group =
		unit.id === ids.search
			? { id: 'inputs', title: 'Inputs' }
			: { id: 'orders', title: commit === 'a'.repeat(40) ? 'Purchases' : 'Orders' };
	const source = unit.owns.source.map((path) =>
		path.includes('/routes/') || path.includes(`/${group.id}/`)
			? path
			: path.replace(/^(.*src\/[^/]+\/)/, `$1${group.id}/`)
	);
	return {
		...unit,
		group,
		...(unit.configValues
			? { configValues: unit.configValues.map((setting) => ({ ...setting, source: source[0] })) }
			: {}),
		...(unit.id === ids.filter ? textHelper(unit, commit) : {}),
		owns: {
			...unit.owns,
			source: [
				...new Set([
					...unit.owns.source,
					...source,
					...(unit.id === ids.filter
						? ['src/helpers/orders/filterOrders.ts', 'src/helpers/strings/plural.ts']
						: [])
				])
			]
		},
		runtime: {
			...unit.runtime,
			targets: unit.runtime.targets.map((target) => ({ ...target, entry: source[0] }))
		}
	};
}

function deliveryConfig(settings: HarnessUnit): HarnessUnit {
	return {
		...settings,
		id: 'app.config.delivery-settings',
		title: 'deliverySettings',
		owns: { source: ['src/configs/orders/deliverySettings.ts'], symbols: ['deliverySettings'] },
		configValues: [
			{
				name: 'deliverySettings.enabled',
				value: 'true',
				source: 'src/configs/orders/deliverySettings.ts',
				literal: true
			}
		]
	};
}

/** Every collection shares revision-bound groups and physical implementation addresses. */
export function categorySources(detail: HarnessRevision): HarnessRevision {
	const delivery = deliveryConfig(detail.registry.units.find((unit) => unit.id === ids.settings)!);
	const model = {
		...units[1],
		id: 'app.model.order',
		kind: 'model',
		title: 'Order',
		responsibility: 'An order placed by an account.',
		dependencies: [],
		owns: { source: ['src/models/orders/Order.ts'], symbols: ['Order'] }
	};
	const types = {
		...model,
		id: 'app.model.order-types',
		title: 'Order.types',
		owns: { source: ['src/models/orders/Order.types.ts'], symbols: ['OrderInput'] }
	};
	return {
		...detail,
		registry: {
			...detail.registry,
			units: [
				...detail.registry.units,
				delivery,
				...(detail.registry.units.some((unit) => unit.id === model.id) ? [] : [model, types])
			].map((unit) =>
				categoryUnit(
					unit.id === ids.store && detail.commit !== 'a'.repeat(40)
						? {
								...unit,
								dependencies: [
									...unit.dependencies,
									{ unit: model.id, via: 'import' },
									{ unit: types.id, via: 'import' }
								]
							}
						: unit,
					detail.commit
				)
			)
		}
	};
}

/** A text export keeps its own folder even when its owning module serves orders. */
function textHelper(unit: HarnessUnit, commit: string) {
	const group = { id: 'strings', title: commit === 'a'.repeat(40) ? 'Words' : 'Strings' };
	return {
		helpers: [
			...(unit.helpers ?? []).map((helper) => ({
				...helper,
				source: 'src/helpers/orders/filterOrders.ts'
			})),
			{
				name: 'plural',
				source: 'src/helpers/strings/plural.ts',
				pure: true,
				group,
				inputs: [
					{ name: 'plural.count', type: 'number' },
					{ name: 'plural.word', type: 'string' }
				],
				consumers: [{ unit: ids.list }, { unit: ids.card }]
			}
		],
		contract: {
			...unit.contract,
			inputs: [
				...unit.contract.inputs,
				{ name: 'plural.count', type: 'number', examples: [2] },
				{ name: 'plural.word', type: 'string', examples: ['item'] }
			],
			outputs: [...unit.contract.outputs, { name: 'plural', type: 'string', examples: ['2 items'] }]
		}
	};
}
