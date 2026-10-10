import { expect, test } from 'vitest';
import { impactRepo, testSource } from './support/impactRepo';
import { slugifySource } from './support/unitProject';

const plugin = [
	'export class PluginService {',
	'\tload(name: string): Promise<unknown> {',
	'\t\treturn import(name);',
	'\t}',
	'}',
	''
].join('\n');

test('an uncertain alias widens selection to its dependents whenever anything changes', async () => {
	const repo = await impactRepo();
	await repo.write('src/services/PluginService.ts', plugin);
	await repo.write(
		'test/services/plugin.test.ts',
		testSource('PluginService', '../../src/services/PluginService')
	);
	await repo.harness(['units', 'index', '--write']);
	await repo.commit('feat: add plugin loader');
	expect((await repo.impact()).tests.selected).toEqual([]);

	await repo.write(
		'src/utils/clock.ts',
		'export function clock(value: string): string {\n\treturn `${value}!`;\n}\n'
	);
	const report = await repo.impact();
	expect(report.expanded).toBe(false);
	expect(report.tests.selected).toEqual([
		'test/services/clock.test.ts',
		'test/services/plugin.test.ts'
	]);
	expect(report.units.direct).toEqual(['function.clock']);
	expect(report.units.indirect).toEqual(['service.clock', 'service.plugin']);
	expect(report.uncertain).toEqual([
		{
			node: 'file:src/services/PluginService.ts',
			reason: 'non-literal-import',
			detail: 'import(name)'
		}
	]);
	await repo.dispose();
}, 90_000);

test('unclassified and uncovered changes select every test and say why', async () => {
	const repo = await impactRepo();
	await repo.write('src/utils/orphan.ts', 'export function orphan(): number {\n\treturn 1;\n}\n');
	await repo.write('assets/data.bin', 'one');
	await repo.harness(['units', 'index', '--write']);
	await repo.commit('feat: add orphan');

	await repo.write('src/utils/orphan.ts', 'export function orphan(): number {\n\treturn 2;\n}\n');
	const uncovered = await repo.impact();
	expect(uncovered.expanded).toBe(true);
	expect(uncovered.tests.excluded).toEqual([]);
	expect(uncovered.tests.selected).toHaveLength(5);
	expect(uncovered.uncertain).toEqual([
		{
			node: 'file:src/utils/orphan.ts',
			reason: 'uncovered-change',
			detail: 'no test or scenario depends on this file'
		}
	]);
	await repo.commit('feat: change orphan');

	await repo.write('assets/data.bin', 'two');
	const unclassified = await repo.impact();
	expect(unclassified.expanded).toBe(true);
	expect(unclassified.changed).toEqual([
		{ path: 'assets/data.bin', status: 'modified', classification: 'other' }
	]);
	expect(unclassified.uncertain).toEqual([
		{ node: 'file:assets/data.bin', reason: 'unclassified-change', detail: 'assets/data.bin' }
	]);
	await repo.dispose();
}, 90_000);

test('a declared process contract carries impact across the runtime boundary', async () => {
	const repo = await impactRepo();
	const path = 'specification/units/service.clock.json';
	const manifest = await repo.json<{ dependencies: unknown[] }>(path);
	const link = {
		unit: 'function.slugify',
		via: 'process',
		origin: 'declared',
		contract: 'slugify'
	};
	await repo.write(
		path,
		JSON.stringify({ ...manifest, dependencies: [...manifest.dependencies, link] })
	);
	await repo.harness(['units', 'index', '--write']);
	const declared = await repo.impact();
	expect(declared.changed).toEqual([
		{ path, status: 'modified', classification: 'registry', unit: 'service.clock' }
	]);
	expect(declared.units.direct).toEqual(['service.clock']);
	expect(declared.scenarios.affected).toEqual(['clock']);
	await repo.commit('feat: clock shells out to slugify');

	await repo.write('src/utils/slugify.ts', slugifySource.replace('"-"', '"+"'));
	const report = await repo.impact();
	expect(report.units.indirect).toContain('service.clock');
	expect(report.tests.selected).toContain('test/services/clock.test.ts');
	expect(report.scenarios.affected).toEqual(['clock', 'titles']);
	await repo.dispose();
}, 90_000);

test('module, Wasm and native process runtimes report identical impact', async () => {
	const repo = await impactRepo();
	await repo.write('src/utils/slugify.ts', slugifySource.replace('"-"', '"."'));
	const reports = await Promise.all(
		['module', 'wasm', 'process'].map((runtime) => repo.impact(['--runtime', runtime]))
	);
	expect(reports.map((report) => report.runtime)).toEqual(['module', 'wasm', 'process']);
	for (const report of reports)
		expect({ ...report, runtime: '' }).toEqual({ ...reports[0], runtime: '' });
	expect(reports[0].tests.selected).toHaveLength(3);

	const http = await repo.harness(['impact', '--runtime', 'http'], false);
	expect(http.exitCode).toBe(1);
	expect(http.stderr).toContain('HARNESS_KERNEL_URL');
	const text = await repo.harness(['impact']);
	expect(text.stdout).toContain('3 of 5 tests selected');
	await repo.dispose();
}, 90_000);
