import { measureWorkload } from '../support/measureWorkload';
import { expect, test } from 'vitest';
import { unitMetadata } from '../../src/services/revision-detail-service/unitMetadata';
import { revisionRegistry } from '../../src/utils/revision-registry/revisionRegistry';
import { indexFiles, memoryTree } from '../support/memoryTree';
import {
	referenceCases as cases,
	declarationSource as source,
	modelDeclarationSource,
	modelDeclarations,
	serviceClassCases,
	serviceClassFiles
} from '../support/referenceFixtures';
test('revision metadata derives project categories from the same committed source tree', async () => {
	const paths = ['services', 'components', 'utils', 'models', 'config'].map(
		(folder) => `src/${folder}/payments/Example.ts`
	);
	const files = Object.fromEntries(paths.map((path) => [path, 'export const example = 1;']));
	files[paths[2]] = '/** @pure */ export function example() { return 1; }';
	files[paths[3]] = modelDeclarationSource;
	const config = (title: string) =>
		JSON.stringify({ schemaVersion: 1, groups: [{ id: 'payments', title, terms: [] }] });
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	const tree = memoryTree({ ...files, 'harness.groups.json': config('Payments') });
	const readDeclarations = () => unitMetadata(tree, registry.units);
	await measureWorkload('function.unit-metadata', 'model-and-type-declarations', readDeclarations);
	const model = registry.units.find((unit) => unit.kind === 'model')!;
	expect(model, 'revision metadata reads model and type declarations').toHaveProperty(
		'modelDefinitions',
		modelDeclarations
	);

	for (const unit of registry.units)
		expect(unit).toHaveProperty('group', { id: 'payments', title: 'Payments' });
	expect(registry.units.find((unit) => unit.helpers?.length)?.helpers?.[0]).toHaveProperty(
		'group',
		{ id: 'payments', title: 'Payments' }
	);
	const settings = registry.units.find((unit) => unit.kind === 'config')!;
	expect(settings, 'configs record their committed variable values').toHaveProperty(
		'configValues',
		[{ name: 'example', value: '1', source: paths[4], literal: 1 }]
	);
	files[paths[4]] = 'export const example = 2;';
	await unitMetadata(
		memoryTree({ ...files, 'harness.groups.json': config('Billing') }),
		registry.units
	);
	for (const unit of registry.units)
		expect(unit).toHaveProperty('group', { id: 'payments', title: 'Billing' });
	expect(registry.units.find((unit) => unit.helpers?.length)?.helpers?.[0]).toHaveProperty(
		'group',
		{ id: 'payments', title: 'Billing' }
	);
	expect(settings).toHaveProperty('configValues', [
		{ name: 'example', value: '2', source: paths[4], literal: 2 }
	]);
	await unitMetadata(memoryTree(files), registry.units);
	for (const unit of registry.units) expect(unit).not.toHaveProperty('group');
	await unitMetadata(memoryTree({}), registry.units);
	expect(model, 'missing source clears declarations').toHaveProperty('modelDefinitions', []);
	expect(settings, 'missing source cannot keep a previous revision value').toHaveProperty(
		'configValues',
		[]
	);
});
test('revision metadata lists standalone shared exports without requiring callers', async () => {
	const paths = [
		'src/utils/helpers.ts',
		'packages/app/src/lib/utils/helpers.ts',
		'src/components/local.ts',
		'src/services/local.ts',
		'src/rules/local.ts'
	];
	const files = Object.fromEntries(paths.map((path) => [path, source]));
	const indexed = await indexFiles(files);
	const registry = revisionRegistry(indexed.result.manifests, []);
	await unitMetadata(memoryTree(files), registry.units);
	for (const unit of registry.units) {
		const path = unit.owns.source[0];
		const names = unit.helpers?.map((helper) => helper.name);
		expect(names).toEqual(
			path.includes('/utils/') ? ['typed', 'single', 'unused', 'sharedArrow'] : []
		);
	}
	const shared = registry.units.find((unit) => unit.owns.source[0] === paths[0])!;
	await unitMetadata(memoryTree({ [paths[0]]: 'export function later() {}' }), [shared]);
	expect(shared.helpers?.map((helper) => helper.name)).toEqual(['later']);
	await unitMetadata(memoryTree({}), [shared]);
	expect(shared.helpers).toEqual([]);
	expect(shared.helperGap).toContain('could not be read');
});
test.each(cases)(
	'revision metadata counts distinct actual consumers: $count',
	async ({ files, count }) => {
		const sources = {
			'src/utils/shared.ts':
				'export function shared() { return shared; }\nexport function other() {}',
			...files
		};
		const indexed = await indexFiles(sources);
		const registry = revisionRegistry(indexed.result.manifests, []);
		await unitMetadata(memoryTree(sources), registry.units);
		const helper = registry.units
			.find((unit) => unit.id === 'function.shared')!
			.helpers!.find((helper) => helper.name === 'shared')!;
		expect(
			helper.consumers?.length,
			'distinct services, components and functions count as users'
		).toBe(count);
		const earlier = memoryTree({ 'src/utils/shared.ts': sources['src/utils/shared.ts'] });
		await unitMetadata(earlier, registry.units);
		expect(
			registry.units.find((unit) => unit.id === 'function.shared')!.helpers![0].consumers
		).toEqual([]);
	}
);
const pureCases = [
	['/** @pure */\nexport function env() { return process.env.MODE; }', false],
	['let state = 0;\n/** @pure */\nexport function captured() { return state; }', false],
	['/** @pure */\nexport function writeFile() { console.log("side effect"); return 1; }', false],
	[
		'/** @pure */\nexport function formatDate(iso: string) { return new Date(iso).toISOString(); }',
		true
	],
	['export function shared(value: string) { return value.trim(); }', false],
	['/** @pure */\nexport async function load() { return fetch("/api"); }', false],
	['/** @pure */\nexport function now() { return Date.now(); }', false],
	['/** @pure */\nexport function random() { return Math.random(); }', false],
	['/** @pure */\nexport function mutate(input: number[]) { return input.sort(); }', false],
	[
		'/** @pure */\nexport function write(input: {value: number}) { input.value++; return input; }',
		false
	],
	['export function fake() { return "/** @pure */"; }', false]
] as const;
test.each(pureCases)(
	'helper purity is an explicit, checked source contract: %s',
	async (source, pure) => {
		const files = { 'src/utils/helper.ts': source };
		const indexed = await indexFiles(files);
		const registry = revisionRegistry(indexed.result.manifests, []);
		await unitMetadata(memoryTree(files), registry.units);
		expect(registry.units[0].helpers?.[0]).toMatchObject({ pure });
	}
);
// Services count the owning code unit once, including top-level page and entry references.
test.each(cases.map((item, index) => ({ ...item, serviceCount: [2, 2, 1, 1, 2, 0, 0, 2][index] })))(
	'revision metadata counts distinct runtime service owners: $serviceCount',
	async ({ files, serviceCount }) => {
		const sources = {
			'src/services/SharedService.ts':
				'export function shared() { return 1; } export function other() {}',
			...Object.fromEntries(
				Object.entries(files).map(([path, text]) => [
					path,
					text
						.replaceAll('../utils/shared', '../services/SharedService')
						.replaceAll("'./shared'", "'../services/SharedService'")
				])
			)
		};
		const indexed = await indexFiles(sources);
		const registry = revisionRegistry(indexed.result.manifests, []);
		await unitMetadata(memoryTree(sources), registry.units);
		const service = registry.units.find((unit) =>
			unit.owns.source.includes('src/services/SharedService.ts')
		)!;
		expect(service.serviceConsumers?.length, 'only distinct runtime owners establish sharing').toBe(
			serviceCount
		);
		await unitMetadata(
			memoryTree({ 'src/services/SharedService.ts': sources['src/services/SharedService.ts'] }),
			registry.units
		);
		expect(service.serviceConsumers).toEqual([]);
	}
);
test.each(serviceClassCases)(
	'revision metadata proves service class declarations and construction: $label',
	async ({ label, declaration, methods }) => {
		const files = serviceClassFiles(label, declaration);
		const indexed = await indexFiles(files);
		const registry = revisionRegistry(indexed.result.manifests, []);
		await unitMetadata(memoryTree(files), registry.units);
		const service = registry.units.find((unit) =>
			unit.owns.source.includes('src/services/SharedService.ts')
		)!;
		const owners = registry.units
			.filter((unit) =>
				unit.owns.source.some((path) => /workflows\/(first|second)\.ts$/.test(path))
			)
			.map((unit) => ({ unit: unit.id }))
			.sort((a, b) => a.unit.localeCompare(b.unit));
		const consumers = label === 'shadow' ? [] : owners;
		let constructedBy = consumers;
		if (label === 'registry' || label === 'shadow') constructedBy = [];
		if (label === 'factory') constructedBy = [{ unit: service.id }];
		expect(service, 'class proof comes from source').toHaveProperty(
			'serviceClasses',
			methods === null
				? []
				: [
						{
							name: 'SharedService',
							source: 'src/services/SharedService.ts',
							methods,
							constructedBy,
							consumers
						}
					]
		);
		await unitMetadata(memoryTree({}), registry.units);
		expect(service).toHaveProperty('serviceClasses', []);
	}
);
