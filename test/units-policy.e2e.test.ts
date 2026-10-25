import { runCommand } from './support/cli';
import type { Shown, Labelled } from './units-policy.e2e.test.types';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import {
	slugifySource,
	unitProject,
	configureTestAuthor,
	validationInvoker
} from './support/unitProject';

test('CLI exposes execution targets and component versions, and refuses relaxed tolerance', async () => {
	const project = await unitProject('lib');
	await project.write('src/utils/slugify.ts', slugifySource);
	await project.harness(['units', 'index', '--write']);
	const shown = await project.harnessJson<Shown>(['units', 'show', 'function.slugify']);
	expect(shown.manifest.runtime).toEqual({
		kind: 'module',
		entry: 'src/utils/slugify.ts',
		targets: [{ kind: 'module', entry: 'src/utils/slugify.ts' }]
	});
	expect(shown.version.unit).toBe('function.slugify');
	for (const key of ['manifest', 'source', 'contract', 'runtime'] as const) {
		expect(shown.version[key]).toMatch(/^[0-9a-f]{64}$/);
	}

	const path = 'specification/units/function.slugify.json';
	const examples = [0, false, null, 'A title', { label: 'An item' }];
	await project.write(
		path,
		JSON.stringify({
			...shown.manifest,
			contract: {
				...shown.manifest.contract,
				origin: 'declared',
				inputs: shown.manifest.contract.inputs.map((field) => ({
					...field,
					type: 'unknown',
					examples
				}))
			}
		})
	);
	await project.harness(['units', 'index', '--write']);
	await project.harness(['units', 'check']);
	const documented = await project.harnessJson<Shown>(['units', 'show', 'function.slugify']);
	expect(documented.manifest.contract.inputs[0].examples).toEqual(examples);
	expect(documented.version.contract).not.toBe(shown.version.contract);

	const budget = { workload: 'slugify-1k', metric: 'latency-warm-ms', tolerance: 0.25 };
	const relaxed = {
		...shown.manifest,
		budgets: { ...shown.manifest.budgets, performance: [budget] }
	};
	await project.write(path, JSON.stringify(relaxed));
	const check = await project.harness(['units', 'check'], false);
	expect(check.exitCode).toBe(1);
	expect(check.stderr).toContain('function.slugify: budgets.performance.0.tolerance');
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);

test('CLI records lineage when retired source is recreated under a new identity', async () => {
	const project = await unitProject('lib');
	await project.write('src/utils/slugify.ts', slugifySource);
	await project.harness(['units', 'index', '--write']);
	await rm(join(project.root, 'src/utils/slugify.ts'));
	await project.harness(['units', 'retire', 'function.slugify', '--reason', 'Removed']);
	await mkdir(join(project.root, 'src/core'), { recursive: true });
	await project.write('src/core/slug.ts', slugifySource);
	const index = await project.harnessJson<{ added: string[] }>(['units', 'index', '--write']);
	expect(index.added).toEqual(['function.slug']);
	const shown = await project.harnessJson<Shown>(['units', 'show', 'function.slug']);
	expect(shown.manifest.lineage).toEqual({ predecessors: ['function.slugify'] });
	await project.harness(['units', 'check']);
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);

test('CLI labels a supplied responsibility as declared and a generated one as derived', async () => {
	const project = await unitProject('lib');
	await project.harness(['generate', 'unit', 'PriceQuote']);
	await project.harness([
		'generate',
		'unit',
		'Billing',
		'--kind',
		'service',
		'--responsibility',
		'Charges an invoice exactly once.'
	]);
	const derived = await project.json<Labelled>('specification/units/function.price-quote.json');
	const declared = await project.json<Labelled>('specification/units/service.billing.json');
	expect([derived.responsibility, derived.responsibilityOrigin]).toEqual([
		'Owns the priceQuote shared function.',
		'derived'
	]);
	expect([declared.responsibility, declared.responsibilityOrigin]).toEqual([
		'Charges an invoice exactly once.',
		'declared'
	]);
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);

test('public configs require real source controls and retain their reviewed declarations', async () => {
	const project = await unitProject('lib');
	try {
		await project.harness(['generate', 'config', 'Downloads']);
		await project.harness(['units', 'index', '--write']);
		const path = 'specification/units/config.downloads.json';
		const manifest = await project.json(path);
		expect(manifest.catalog).toEqual({ visibility: 'internal' });
		const source = 'src/configs/downloadsConfig.ts';
		await project.write(
			source,
			'export const downloadsConfig = { maxBytes: 1000, formatVersion: 1 };\n'
		);
		const publicConfig = { ...manifest, catalog: { visibility: 'public' } };
		await project.write(path, JSON.stringify(publicConfig));
		const missing = await project.harness(['units', 'check'], false);
		expect(missing.exitCode).toBe(1);
		expect(missing.stderr).toContain('requires reviewed configControls');
		const control = {
			source,
			name: 'downloadsConfig.maxBytes',
			audience: 'operator',
			purpose: 'Bound download storage for the device running the app.'
		};
		await project.write(path, JSON.stringify({ ...publicConfig, configControls: [control] }));
		await project.harness(['units', 'index', '--write']);
		await project.harness(['units', 'check']);
		expect((await project.json(path)).configControls).toEqual([control]);
		for (const controls of [
			[control, control],
			[{ ...control, source: 'unowned.ts' }],
			[{ ...control, name: 'downloadsConfig.missing' }]
		]) {
			await project.write(path, JSON.stringify({ ...publicConfig, configControls: controls }));
			const invalid = await project.harness(['units', 'check'], false);
			expect(invalid.exitCode).toBe(1);
			expect(invalid.stderr).toMatch(
				/duplicate control|unowned source|not a recorded config value/
			);
		}
		await project.write(path, JSON.stringify({ ...publicConfig, configControls: [control] }));
		await rm(join(project.root, source));
		await project.harness(['units', 'retire', 'config.downloads', '--reason', 'Retired control']);
		await project.harness(['units', 'index', '--write']);
		await project.harness(['units', 'check']);
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 60_000);

test('source-bound reviews repair historical default runtime targets without changing source commits', async () => {
	const project = await unitProject('lib');
	const git = (args: string[]) => runCommand(['git', ...args], project.root);
	try {
		await git(['init', '-b', 'main']);
		await configureTestAuthor(project.root);
		await project.write(
			'src/services/TitleService.ts',
			'export class TitleService { run(): string { return "Title"; } }'
		);
		await project.harness(['units', 'index', '--write']);
		const path = 'specification/units/service.title.json';
		const manifest = await project.json<{
			runtime: { kind: string; entry: string; targets: Array<{ kind: string; entry: string }> };
		}>(path);
		const wanted = {
			...manifest.runtime,
			targets: [{ kind: manifest.runtime.kind, entry: manifest.runtime.entry }]
		};
		manifest.runtime.targets = [{ kind: 'module', entry: 'src/services/old/TitleService.ts' }];
		await project.write(path, JSON.stringify(manifest));
		await git(['add', '.']);
		await git(['commit', '-m', 'feat: retain historical runtime target']);
		const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
		const invoke = validationInvoker(project);
		const before = await invoke(['--write', '--module', 'service.title']);
		expect(JSON.stringify(before.modules)).toContain('runtime.targets must include');
		const review = join(project.root, '..', 'runtime-review.json');
		await writeFile(
			review,
			JSON.stringify({
				unit: 'service.title',
				reason: 'Bind the default target to the owned implementation at this source commit.',
				metadata: { runtime: wanted }
			})
		);
		const repaired = await invoke(['--write', '--review', review, '--module', 'service.title']);
		expect(repaired.valid, JSON.stringify(repaired)).toBe(true);
		expect(repaired.committed).toBe(true);
		expect((await invoke(['--write', '--refresh', '--module', 'service.title'])).valid).toBe(true);
		expect((await git(['rev-parse', 'HEAD'])).stdout.trim()).toBe(head);
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);
