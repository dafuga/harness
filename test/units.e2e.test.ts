import type { Manifest, IndexResult } from './units.e2e.test.types';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	slugifySource,
	titleServiceSource,
	unitProject,
	unitLifecycleScenario,
	sharedDateHelperProject,
	utcDateExamples
} from './support/unitProject';

test('generic unit generator coexists with the Svelte component generator', async () => {
	const project = await unitProject('app');
	const unit = await project.harness(['generate', 'unit', 'PriceQuote']);
	expect(unit.stdout).toContain('create src/utils/priceQuote.ts');
	expect(unit.stdout).toContain('create specification/units/function.price-quote.json');
	const component = await project.harness(['generate', 'component', 'PriceQuote']);
	expect(component.stdout).toContain('create src/components/PriceQuote.svelte');

	const manifest = await project.json<Manifest>('specification/units/function.price-quote.json');
	expect(manifest).toMatchObject({
		schemaVersion: 1,
		id: 'function.price-quote',
		kind: 'function',
		status: 'active',
		owns: { source: ['src/utils/priceQuote.ts'], symbols: ['priceQuote'] },
		runtime: { kind: 'module', entry: 'src/utils/priceQuote.ts' },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen' }
	});
	expect(manifest.responsibility.length).toBeGreaterThan(10);

	const index = await project.harnessJson<IndexResult>(['units', 'index', '--write']);
	expect(index.added).toContain('component.price-quote');
	expect(index.added).not.toContain('function.price-quote');
	await project.harness(['units', 'check']);
	const service = await project.harness(['generate', 'unit', 'Billing', '--kind', 'service']);
	expect(service.stdout).toContain('create src/services/BillingService.ts');
	expect(service.stdout).toContain('create specification/units/service.billing.json');
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);
test('index derives contracts and keeps identity stable across re-index, moves and recreation', async () => {
	const project = await unitProject('lib');
	await project.write('src/utils/slugify.ts', slugifySource);
	await project.write('src/services/TitleService.ts', titleServiceSource);
	const first = await project.harnessJson<IndexResult>(['units', 'index', '--write']);
	expect(first.added).toEqual(expect.arrayContaining(['function.slugify', 'service.title']));

	const slugify = await project.json<Manifest>('specification/units/function.slugify.json');
	expect(slugify.contract.origin).toBe('derived');
	expect(slugify.contract.inputs).toEqual([
		{ name: 'slugify.input', type: 'string' },
		{ name: 'slugify.separator', type: 'unknown' }
	]);
	expect(slugify.contract.outputs).toEqual([{ name: 'slugify', type: 'string' }]);
	expect(slugify.contract.errors).toEqual([{ name: 'RangeError', type: 'thrown' }]);
	const title = await project.json<Manifest>('specification/units/service.title.json');
	expect(title.dependencies).toEqual([
		{ unit: 'function.slugify', via: 'import', origin: 'derived' }
	]);
	expect(title.owns.symbols).toEqual(['TitleService', 'TitleService.run']);

	const again = await project.harnessJson<IndexResult>(['units', 'index', '--write']);
	expect([again.added, again.updated, again.moved]).toEqual([[], [], []]);

	await mkdir(join(project.root, 'src/core'), { recursive: true });
	await rename(join(project.root, 'src/utils/slugify.ts'), join(project.root, 'src/core/slug.ts'));
	await project.write(
		'src/services/TitleService.ts',
		titleServiceSource.replace('../utils/slugify', '../core/slug')
	);
	const moved = await project.harnessJson<IndexResult>(['units', 'index', '--write']);
	expect(moved.moved).toEqual([
		{ id: 'function.slugify', from: 'src/utils/slugify.ts', to: 'src/core/slug.ts' }
	]);
	expect(moved.added).toEqual([]);

	await rm(join(project.root, 'src/core/slug.ts'));
	await project.write('src/services/TitleService.ts', 'export class TitleService {}\n');
	const stale = await project.harness(['units', 'check'], false);
	expect(stale.exitCode).toBe(1);
	expect(stale.stderr).toContain('function.slugify owns missing source src/core/slug.ts');
	await project.harness(['units', 'retire', 'function.slugify', '--reason', 'Inlined into titles']);
	await project.harness(['units', 'index', '--write']);
	await project.harness(['units', 'check']);

	await project.write('src/utils/slugify.ts', slugifySource);
	const other = await project.harnessJson<IndexResult>(['units', 'index', '--write']);
	expect(other.added).toEqual(['function.slugify-2']);
	await project.write('src/core/slug.ts', slugifySource);
	const revived = await project.harnessJson<IndexResult>(['units', 'index', '--write']);
	expect(revived.revived).toEqual(['function.slugify']);
	expect(revived.added).toEqual([]);
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);
test('check rejects invalid manifests and schemas are exposed', async () => {
	const project = await unitProject('lib');
	await project.write('src/utils/slugify.ts', slugifySource);
	await project.harness(['units', 'index', '--write']);
	const path = 'specification/units/function.slugify.json';
	const manifest = await project.json<Manifest>(path);
	await project.write(
		path,
		JSON.stringify({
			...manifest,
			responsibility: '',
			dependencies: [{ unit: 'service.absent', via: 'http', origin: 'declared' }]
		})
	);
	const invalid = await project.harness(['units', 'check'], false);
	expect(invalid.exitCode).toBe(1);
	expect(invalid.stderr).toContain('function.slugify: responsibility');
	expect(invalid.stderr).toContain('function.slugify depends on unknown unit service.absent');

	for (const name of ['ComponentManifest', 'ScenarioManifest', 'VerificationRecord']) {
		const schema = JSON.parse((await project.harness(['units', 'schema', name])).stdout);
		expect(schema.type).toBe('object');
		expect(schema.required).toContain('schemaVersion');
	}
	const component = JSON.parse(
		(await project.harness(['units', 'schema', 'ComponentManifest'])).stdout
	);
	expect(component.required).toEqual(
		expect.arrayContaining([
			'id',
			'responsibility',
			'owns',
			'contract',
			'dependencies',
			'runtime',
			'scenarios',
			'budgets'
		])
	);
	const unknown = await project.harness(['units', 'schema', 'Nope'], false);
	expect(unknown.stderr).toContain('Unknown schema "Nope"');
	const info = await project.harness(['info', 'unit']);
	expect(info.stdout).toContain('harness generate unit');
	try {
		await project.write(path, JSON.stringify(manifest));
		await project.write(
			'test/slugify.test.ts',
			"import { expect, test } from 'vitest'; import { slugify } from '../src/utils/slugify'; test('slugify: lowercases a title', () => expect(slugify('A B')).toBe('a-b'));\n"
		);
		await project.write(
			'specification/scenarios/unit-lifecycle.json',
			JSON.stringify(unitLifecycleScenario)
		);
		expect((await project.harness(['scenarios', 'check'], false)).exitCode).toBe(0);
		await project.write(
			path,
			JSON.stringify({
				...manifest,
				status: 'retired',
				retired: { reason: 'Fixture retired', at: '2026-01-01T00:00:00.000Z' }
			})
		);
		const retired = await project.harness(['scenarios', 'check'], false);
		const registry = await project.harness(['units', 'check'], false);
		const message = 'unit-lifecycle covers retired unit function.slugify';
		expect([retired.stderr.includes(message), registry.stderr.includes(message)], message).toEqual([
			true,
			true
		]);
		expect([retired.exitCode, registry.exitCode]).toEqual([1, 1]);
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 60_000);

test('index records reviewed shared helper contracts for clients without source rescans', async () => {
	const project = await sharedDateHelperProject();
	const unit = await project.json<{ helperContracts: unknown[] }>(
		'specification/units/helper.dates-format-date.json'
	);
	expect(unit.helperContracts, 'committed pure helper contracts').toEqual([
		expect.objectContaining({
			name: 'formatDate',
			pure: true,
			source: 'src/helpers/dates/formatDate.ts',
			consumers: expect.arrayContaining([
				{ unit: 'function.first', symbol: 'first' },
				{ unit: 'function.second', symbol: 'second' }
			])
		})
	]);
	const missing = await project.harness(['units', 'check'], false);
	expect(missing.exitCode, 'Callable examples are required').toBe(1);
	const examples = utcDateExamples;
	const writeExamples = (examples: unknown[]) =>
		project.write(
			'specification/units/helper.dates-format-date.json',
			JSON.stringify({
				...unit,
				helperContracts: unit.helperContracts.map((item) => ({ ...(item as object), examples }))
			})
		);
	for (const names of [
		['Example 1'],
		['formatDate: example 2'],
		['UTC date', ' utc DATE '],
		['UTC date', 'Date formatting']
	]) {
		await writeExamples(names.map((name) => ({ ...examples[0], name })));
		await project.harness(['units', 'index', '--write']);
		const rejected = await project.harness(['units', 'check'], false);
		expect(rejected.exitCode, 'Distinct descriptive helper behaviors are required').toBe(1);
	}
	await writeExamples(examples);
	await project.harness(['units', 'index', '--write']);
	const again = await project.json<{ helperContracts: Array<{ examples: unknown }> }>(
		'specification/units/helper.dates-format-date.json'
	);
	expect(again.helperContracts[0].examples).toEqual(examples);
	await project.harness(['units', 'check']);
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60000);
