import { modelDefinition } from './entityClassFixtures';
import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { ids, units } from './entityUnits';
import taxonomy from '../../../harness.groups.json' with { type: 'json' };
import { moduleGroup } from '../../../src/utils/development-tooling/moduleGroup';

import componentsList from '../../../specification/units/reports.page.harness-branch-branch-at-components.json' with { type: 'json' };
import componentsDetail from '../../../specification/units/reports.page.harness-branch-branch-at-components-entity.json' with { type: 'json' };
import componentsHistory from '../../../specification/units/reports.page.harness-branch-branch-at-components-entity-history.json' with { type: 'json' };
import configsList from '../../../specification/units/reports.page.harness-branch-branch-at-configs.json' with { type: 'json' };
import configsDetail from '../../../specification/units/reports.page.harness-branch-branch-at-configs-entity.json' with { type: 'json' };
import configsHistory from '../../../specification/units/reports.page.harness-branch-branch-at-configs-entity-history.json' with { type: 'json' };
import functionsList from '../../../specification/units/reports.page.harness-branch-branch-at-functions.json' with { type: 'json' };
import functionsDetail from '../../../specification/units/reports.page.harness-branch-branch-at-functions-entity.json' with { type: 'json' };
import functionsHistory from '../../../specification/units/reports.page.harness-branch-branch-at-functions-entity-history.json' with { type: 'json' };
import layoutsList from '../../../specification/units/reports.page.harness-branch-branch-at-layouts.json' with { type: 'json' };
import layoutsDetail from '../../../specification/units/reports.page.harness-branch-branch-at-layouts-entity.json' with { type: 'json' };
import layoutsHistory from '../../../specification/units/reports.page.harness-branch-branch-at-layouts-entity-history.json' with { type: 'json' };
import modelsList from '../../../specification/units/reports.page.harness-branch-branch-at-models.json' with { type: 'json' };
import modelsDetail from '../../../specification/units/reports.page.harness-branch-branch-at-models-entity.json' with { type: 'json' };
import modelsHistory from '../../../specification/units/reports.page.harness-branch-branch-at-models-entity-history.json' with { type: 'json' };
import pagesList from '../../../specification/units/reports.page.harness-branch-branch-at-pages.json' with { type: 'json' };
import pagesDetail from '../../../specification/units/reports.page.harness-branch-branch-at-pages-entity.json' with { type: 'json' };
import pagesHistory from '../../../specification/units/reports.page.harness-branch-branch-at-pages-entity-history.json' with { type: 'json' };
import servicesList from '../../../specification/units/reports.page.harness-branch-branch-at-services.json' with { type: 'json' };
import servicesDetail from '../../../specification/units/reports.page.harness-branch-branch-at-services-entity.json' with { type: 'json' };
import servicesHistory from '../../../specification/units/reports.page.harness-branch-branch-at-services-entity-history.json' with { type: 'json' };
import platformsList from '../../../specification/units/reports.page.harness-branch-branch-at-platforms.json' with { type: 'json' };
import platformsDetail from '../../../specification/units/reports.page.harness-branch-branch-at-platforms-entity.json' with { type: 'json' };
import stylesList from '../../../specification/units/reports.page.harness-branch-branch-at-styles.json' with { type: 'json' };

/** Actual manifests and taxonomy exercise feature folders beside synthetic history. */
const projectPages = [
	componentsList,
	componentsDetail,
	componentsHistory,
	configsList,
	configsDetail,
	configsHistory,
	functionsList,
	functionsDetail,
	functionsHistory,
	layoutsList,
	layoutsDetail,
	layoutsHistory,
	modelsList,
	modelsDetail,
	modelsHistory,
	pagesList,
	pagesDetail,
	pagesHistory,
	servicesList,
	servicesDetail,
	servicesHistory,
	platformsList,
	platformsDetail,
	stylesList
] as unknown as HarnessUnit[];

export function projectPageSources(detail: HarnessRevision): HarnessRevision {
	const pages = projectPages.filter((unit) =>
		unit.owns.source.some((path) =>
			/\/\[\.\.\.at\]\/(components|configs|functions|layouts|models|pages|services|platforms|styles)\//.test(
				path
			)
		)
	);
	return {
		...detail,
		registry: {
			...detail.registry,
			units: [
				...detail.registry.units,
				...pages.map((unit) => ({
					...unit,
					group: moduleGroup(unit.owns.source, taxonomy.groups),
					version: 'fixture-manifest-without-source-version'
				}))
			]
		}
	};
}

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
		responsibility: 'Wraps stored order data.',
		modelDefinitions: [modelDefinition('Order', 'src/models/orders/Order.ts')],
		dependencies: [],
		owns: { source: ['src/models/orders/Order.ts'], symbols: ['Order'] }
	};
	const types = {
		...model,
		id: 'app.model.order-types',
		title: 'Order.types',
		modelDefinitions: [modelDefinition('OrderInput', 'src/models/orders/Order.types.ts')],
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
