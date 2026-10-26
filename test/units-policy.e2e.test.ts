import type { ComponentManifest } from '../src/core/development-tooling/unitTypes';
import { runCommand } from './support/cli';
import type { Shown, Labelled } from './units-policy.e2e.test.types';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import * as unitFixtures from './support/unitProject';

const { slugifySource, unitProject, configureTestAuthor, validationInvoker, commitModuleData } =
	unitFixtures;

test('CLI exposes execution targets and component versions, and refuses relaxed tolerance', async () => {
	const p = await unitProject('lib'),
		src = 'src/utils/slugify.ts';
	await p.write(src, slugifySource);
	await p.harness(['units', 'index', '--write']);
	await commitModuleData(p);
	const shown = await p.harnessJson<Shown>(['units', 'show', 'function.slugify']);
	const target = { kind: 'module', entry: src };
	expect(shown.manifest.runtime).toEqual({ ...target, targets: [target] });
	expect(shown.version.unit).toBe('function.slugify');
	for (const key of ['manifest', 'source', 'contract', 'runtime'] as const) {
		expect(shown.version[key]).toMatch(/^[0-9a-f]{64}$/);
	}
	const path = 'specification/units/function.slugify.json';
	const examples = [0, false, null, 'A title', { label: 'An item' }];
	const contract = {
		...shown.manifest.contract,
		origin: 'declared',
		inputs: shown.manifest.contract.inputs.map((field) => ({ ...field, type: 'unknown', examples }))
	};
	await p.write(path, JSON.stringify({ ...shown.manifest, contract }));
	await p.harness(['units', 'index', '--write']);
	await p.harness(['units', 'check']);
	await commitModuleData(p);
	const documented = await p.harnessJson<Shown>(['units', 'show', 'function.slugify']);
	expect(documented.manifest.contract.inputs[0].examples).toEqual(examples);
	expect(documented.version.contract).not.toBe(shown.version.contract);
	const budget = { workload: 'slugify-1k', metric: 'latency-warm-ms', tolerance: 0.25 };
	const budgets = { ...shown.manifest.budgets, performance: [budget] };
	await p.write(path, JSON.stringify({ ...shown.manifest, budgets }));
	const check = await p.harness(['units', 'check'], false);
	expect(check.exitCode).toBe(1);
	expect(check.stderr).toContain('function.slugify: budgets.performance.0.tolerance');
	await rm(join(p.root, '..'), { recursive: true, force: true });
}, 60_000);

test('CLI records lineage when retired source is recreated under a new identity', async () => {
	const p = await unitProject('lib');
	await p.write('src/utils/slugify.ts', slugifySource);
	await p.harness(['units', 'index', '--write']);
	await rm(join(p.root, 'src/utils/slugify.ts'));
	await p.harness(['units', 'retire', 'function.slugify', '--reason', 'Removed']);
	await mkdir(join(p.root, 'src/core'), { recursive: true });
	await p.write('src/core/slug.ts', slugifySource);
	const index = await p.harnessJson<{ added: string[] }>(['units', 'index', '--write']);
	expect(index.added).toEqual(['function.slug']);
	await commitModuleData(p);
	const shown = await p.harnessJson<Shown>(['units', 'show', 'function.slug']);
	expect(shown.manifest.lineage).toEqual({ predecessors: ['function.slugify'] });
	await p.harness(['units', 'check']);
	await rm(join(p.root, '..'), { recursive: true, force: true });
}, 60_000);

test('CLI labels a supplied responsibility as declared and a generated one as derived', async () => {
	const project = await unitProject('lib');
	await project.harness(['generate', 'unit', 'PriceQuote']);
	const billing = ['generate', 'unit', 'Billing', '--kind', 'service', '--responsibility'];
	await project.harness([...billing, 'Charges an invoice exactly once.']);
	const derived = await project.json<Labelled>('specification/units/function.price-quote.json');
	const declared = await project.json<Labelled>('specification/units/service.billing.json');
	expect(derived.responsibility).toBe('Owns the priceQuote shared function.');
	expect(derived.responsibilityOrigin).toBe('derived');
	expect(declared.responsibility).toBe('Charges an invoice exactly once.');
	expect(declared.responsibilityOrigin).toBe('declared');
	await rm(join(project.root, '..'), { recursive: true, force: true });
}, 60_000);

test('CLI authors declared contracts only for valid active units without changing other metadata', async () => {
	const project = await unitProject('lib');
	try {
		const id = 'function.slugify',
			input = 'contract.json',
			file = join(project.root, `specification/units/${id}.json`);
		await project.write('src/utils/slugify.ts', slugifySource);
		await project.harness(['units', 'index', '--write']);
		const before = await project.json<ComponentManifest>(`specification/units/${id}.json`);
		const value = {
			responsibility: 'Turns labels into URL slugs.',
			contract: {
				inputs: [{ name: 'label', type: 'string' }],
				outputs: [{ name: 'slug', type: 'string' }],
				errors: []
			}
		};
		await project.write(input, JSON.stringify(value));
		const command = (unit: string) => ['units', 'contract', unit, '--input', input];
		const receipt = await project.harnessJson<{ id: string; manifest: ComponentManifest }>([
			...command(id),
			'--json'
		]);
		const authored = await project.json<ComponentManifest>(`specification/units/${id}.json`);
		expect(receipt).toEqual({ id, manifest: authored });
		expect(authored).toEqual({
			...before,
			responsibility: value.responsibility,
			responsibilityOrigin: 'declared',
			contract: { ...value.contract, origin: 'declared' }
		});
		const bytes = await readFile(file, 'utf8');
		const run = (unit: string) => project.harness(command(unit), false);
		const reject = async (unit: string, body: string, original = bytes) => {
			await project.write(input, body);
			const result = await run(unit);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).not.toBe('');
			expect(await readFile(file, 'utf8')).toBe(original);
		};
		const invalid = [
			'{',
			'{"responsibility":"x","extra":true,"contract":{"inputs":[],"outputs":[],"errors":[]}}',
			'{"responsibility":"x","contract":{"inputs":[],"outputs":[],"errors":[],"extra":true}}',
			'{"responsibility":"x","contract":{"inputs":[{"name":"x","type":"string","extra":true}],"outputs":[],"errors":[]}}',
			'{"responsibility":"x","contract":{"inputs":[{"name":"x"}],"outputs":[],"errors":[]}}'
		];
		for (const body of invalid) await reject(id, body);
		await reject('function.unknown', JSON.stringify(value));
		await rm(join(project.root, 'src/utils/slugify.ts'));
		await project.harness(['units', 'retire', id, '--reason', 'No longer supported']);
		await reject(id, JSON.stringify(value), await readFile(file, 'utf8'));
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
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
		await project.write(source, 'export const downloadsConfig={maxBytes:1000,formatVersion:1};\n');
		const publicConfig = { ...manifest, catalog: { visibility: 'public' } };
		await project.write(path, JSON.stringify(publicConfig));
		const missing = await project.harness(['units', 'check'], false);
		expect(missing.exitCode).toBe(1);
		expect(missing.stderr).toContain('requires reviewed configControls');
		const name = 'downloadsConfig.maxBytes';
		const purpose = 'Bound download storage for the device running the app.';
		const control = { source, name, audience: 'operator', purpose };
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
		const source = 'export class TitleService { run(): string { return "Title"; } }';
		await project.write('src/services/TitleService.ts', source);
		await project.harness(['units', 'index', '--write']);
		const path = 'specification/units/service.title.json';
		const manifest = await project.json<ComponentManifest>(path);
		const wanted = { ...manifest.runtime, targets: manifest.runtime.targets };
		manifest.runtime.targets = [{ kind: 'module', entry: 'src/services/old/TitleService.ts' }];
		manifest.responsibility = 'Serve the title from this module implementation.';
		manifest.responsibilityOrigin = 'derived';
		manifest.preview = { scenario: 'obsolete-preview', state: 'old', viewport: 'desktop' };
		await project.write(path, JSON.stringify(manifest));
		await git(['add', '.']);
		await git(['commit', '-m', 'feat: retain historical runtime target']);
		const head = (await git(['rev-parse', 'HEAD'])).stdout.trim();
		const invoke = validationInvoker(project);
		const before = await invoke(['--write', '--module', 'service.title']);
		expect(before.valid).toBe(false);
		expect(JSON.stringify(before.modules)).toContain('runtime.targets must include');
		const review = join(project.root, '..', 'runtime-review.json');
		const reason = 'Bind the default target to the owned implementation at this source commit.';
		const metadata = { runtime: wanted, responsibility: manifest.responsibility, preview: null };
		const reviewData = { unit: 'service.title', reason, metadata };
		await writeFile(review, JSON.stringify(reviewData));
		const args = ['validate', '--write', '--review', review, '--module', 'service.title', '--json'];
		const accepted = await project.harness(args, false);
		expect(accepted.exitCode, 'Obsolete preview declarations must be withdrawable').toBe(0);
		const repaired = JSON.parse(accepted.stdout);
		expect(repaired.valid, JSON.stringify(repaired)).toBe(true);
		expect(repaired.committed).toBe(true);
		expect((await invoke(['--write', '--refresh', '--module', 'service.title'])).valid).toBe(true);
		expect((await git(['rev-parse', 'HEAD'])).stdout.trim()).toBe(head);
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);
