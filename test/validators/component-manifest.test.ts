import { expect, test } from 'vitest';
import { performanceTolerance, type ComponentManifest } from '../../src/core/unitTypes';
import { ComponentManifestValidator } from '../../src/validators/ComponentManifestValidator';
import { indexFiles, unitOf } from '../support/memoryTree';

const file = 'specification/units/function.rank.json';
const source = {
	'src/utils/rank.ts': 'export function rank(value: number): number {\n\treturn value;\n}\n'
};

async function manifest(): Promise<ComponentManifest> {
	return unitOf(await indexFiles(source), 'function.rank');
}

function errorsOf(value: ComponentManifest): string[] {
	return new ComponentManifestValidator().validate(value, file).errors;
}

test('visual units can bind a preview to one scenario, state and viewport', async () => {
	const preview = { scenario: 'orders', state: 'loaded', viewport: 'desktop' };
	for (const kind of ['page', 'component']) {
		const value = {
			...(await manifest()),
			kind,
			preview,
			testing: {
				version: 1,
				shape: kind,
				cases: [
					{
						id: 'loaded',
						state: 'loaded',
						test: { file: 'tests/e2e/orders.spec.ts', title: 'orders loaded' },
						expected: { kind: 'screenshot', file: 'orders-loaded.png' },
						viewports: ['desktop']
					}
				]
			},
			responsibilityOrigin: 'declared'
		} as ComponentManifest;
		const result = new ComponentManifestValidator().validate(value, file);
		expect(result.errors).toEqual([]);
		expect(result.value).toHaveProperty('preview', preview);
		expect(result.value).toHaveProperty('testing', value.testing);
	}
});

test('headless units cannot declare screenshot previews', async () => {
	const value = {
		...(await manifest()),
		preview: { scenario: 'orders', state: 'loaded', viewport: 'desktop' }
	} as ComponentManifest;
	expect(errorsOf(value).join(' ')).toContain(
		'only page and component units may declare a preview'
	);
});

test('a derived unit names its default execution target and lists it as its only target', async () => {
	const unit = await manifest();
	expect(unit.runtime).toEqual({
		kind: 'module',
		entry: 'src/utils/rank.ts',
		targets: [{ kind: 'module', entry: 'src/utils/rank.ts' }]
	});
	expect(errorsOf(unit)).toEqual([]);
});

test('a unit may declare every applicable execution target beside its default', async () => {
	const unit = await manifest();
	const targets: ComponentManifest['runtime']['targets'] = [
		{ kind: 'module', entry: 'src/utils/rank.ts' },
		{ kind: 'wasm', entry: 'target/kernel/rank.wasm', environment: 'wasm32-unknown-unknown' },
		{ kind: 'process', entry: 'target/release/rank' },
		{ kind: 'http', entry: 'http://127.0.0.1:0/rank' }
	];
	expect(errorsOf({ ...unit, runtime: { ...unit.runtime, targets } })).toEqual([]);
	const wasmDefault = { kind: 'wasm' as const, entry: 'target/kernel/rank.wasm', targets };
	expect(errorsOf({ ...unit, runtime: wasmDefault })).toEqual([]);
});

test('execution targets must include the default and name each runtime once', async () => {
	const unit = await manifest();
	const wasm = { kind: 'wasm' as const, entry: 'target/kernel/rank.wasm' };
	expect(errorsOf({ ...unit, runtime: { ...unit.runtime, targets: [wasm] } })).toEqual([
		'function.rank: runtime.targets must include the default module target src/utils/rank.ts'
	]);
	const twice = [...unit.runtime.targets, wasm, { ...wasm, entry: 'target/kernel/other.wasm' }];
	expect(errorsOf({ ...unit, runtime: { ...unit.runtime, targets: twice } })).toEqual([
		'function.rank: runtime.targets lists wasm more than once'
	]);
	expect(errorsOf({ ...unit, runtime: { ...unit.runtime, targets: [] } })[0]).toContain(
		'function.rank: runtime.targets'
	);
});

test('manifest data cannot relax the performance tolerance beyond five percent', async () => {
	const unit = await manifest();
	const budget = (tolerance: number): ComponentManifest => ({
		...unit,
		budgets: {
			...unit.budgets,
			performance: [{ workload: 'rank-1k', metric: 'latency-warm-ms', tolerance }]
		}
	});
	expect(performanceTolerance).toBe(0.05);
	expect(errorsOf(budget(0.05))).toEqual([]);
	expect(errorsOf(budget(0.01))).toEqual([]);
	const relaxed = errorsOf(budget(0.2));
	expect(relaxed).toHaveLength(1);
	expect(relaxed[0]).toContain('function.rank: budgets.performance.0.tolerance');
	expect(relaxed[0]).toContain('reviewer approval');
});

test('a derived responsibility is labelled derived and cannot be edited without declaring it', async () => {
	const unit = await manifest();
	const edited = { ...unit, responsibility: 'Ranks search results by relevance.' };
	expect(unit.responsibilityOrigin).toBe('derived');
	expect(unit.responsibility).toBe('Owns the rank shared function.');
	expect(errorsOf(edited)).toEqual([
		'function.rank: responsibility differs from the derived text; set responsibilityOrigin to "declared"'
	]);
	expect(errorsOf({ ...edited, responsibilityOrigin: 'declared' })).toEqual([]);
});

test('a unit can name a committed Markdown document, but never escape its repository', async () => {
	const base = await manifest();
	const check = (documentation: string) =>
		new ComponentManifestValidator().validate({ ...base, documentation }, file);
	expect(check('src/functions/rank/README.md').errors).toEqual([]);
	for (const path of [
		'/tmp/rank.md',
		'../rank.md',
		'src/../rank.md',
		'https://example.com/doc.md'
	]) {
		expect(check(path).errors.length).toBeGreaterThan(0);
	}
});
