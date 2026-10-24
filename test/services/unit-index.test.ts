import { assertCompanionOwnership } from './unit-index/ownership';
import { assertCompositionRegistry } from './unit-index/composition';
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { componentManifestSchema, type ComponentManifest } from '../../src/core/unitTypes';
import { SourceGraphService } from '../../src/services/SourceGraphService';
import { UnitRegistryValidator } from '../../src/validators/UnitRegistryValidator';
import { indexFiles, retire, unitOf, helperMoveGaps, serviceMoveGaps } from '../support/memoryTree';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import services from '../../specification/loops/shared-service-ownership/migration.json';
import { rejectedTampering, serviceMoveReviews } from '../support/serviceMoveReviews';
import migration from '../../specification/loops/local-helper-ownership/migration.json';

const slugify = 'export function slugify(input: string): string {\n\treturn input.trim();\n}\n';
const other = 'export function slugifyTitle(input: string): string {\n\treturn input;\n}\n';
test('atomic levels follow runtime calls and survive projections', assertCompositionRegistry);

test('recorded source moves retain definitions, owner-local placement and registered identity', () => {
	const root = import.meta.dirname + '/../..';
	const gaps = helperMoveGaps(root, migration.helpers, migration.followUps);
	expect(migration.helpers).toHaveLength(411);
	const [helper] = migration.helpers;
	expect(helperMoveGaps(root, [helper], [{ ...helper, to: 'missing.ts' }])).not.toEqual([]);
	expect(
		gaps,
		`owner-local helper placement: ${gaps.length} gaps; ${gaps.slice(0, 12).join('; ')}`
	).toEqual([]);
});

test('public route filenames retain their registered ownership', () => {
	const root = import.meta.dirname + '/../..';
	const gaps: string[] = [];
	for (const route of migration.publicRoutes) {
		if (!existsSync(resolve(root, route.source)))
			gaps.push(`${route.unit}: public route filename moved`);
		const unit = JSON.parse(
			readFileSync(resolve(root, `specification/units/${route.unit}.json`), 'utf8')
		) as ComponentManifest;
		if (!unit.owns.source.includes(route.source)) gaps.push(`${route.unit}: route ownership lost`);
	}
	expect(gaps).toEqual([]);
});

test('declared preview and documentation survive source re-indexing', async () => {
	const documentation = 'src/components/Panel.md';
	const files = { 'src/components/Panel.svelte': '<p>Sales</p>', [documentation]: '# Sales' };
	const first = unitOf(await indexFiles(files), 'component.panel');
	const preview = { scenario: 'sales', state: 'loaded', viewport: 'desktop' };
	const declared = componentManifestSchema.parse({ ...first, preview, documentation });
	const again = await indexFiles(files, [declared]);
	expect(unitOf(again, first.id).preview).toEqual(preview);
	expect(unitOf(again, first.id).documentation).toBe(documentation);
	expect(again.result.updated).toEqual([]);
});

async function retiredSlugify(path: string): Promise<ComponentManifest> {
	return retire(unitOf(await indexFiles({ [path]: slugify }), 'function.slugify'));
}

function registryErrors(manifests: ComponentManifest[], paths: string[]): string[] {
	return new UnitRegistryValidator().validate(manifests, new Set(paths));
}

test('declared execution targets survive re-indexing and follow a moved default entry', async () => {
	const first = unitOf(await indexFiles({ 'src/utils/slugify.ts': slugify }), 'function.slugify');
	const wasm = { kind: 'wasm' as const, entry: 'target/kernel/slugify.wasm' };
	const declared = {
		...first,
		runtime: { ...first.runtime, targets: [...first.runtime.targets, wasm] }
	};

	const same = await indexFiles({ 'src/utils/slugify.ts': slugify }, [declared]);
	expect(same.result.updated).toEqual([]);
	expect(unitOf(same, 'function.slugify').runtime.targets).toEqual(declared.runtime.targets);

	const moved = await indexFiles({ 'src/core/slug.ts': slugify }, [declared]);
	expect(moved.result.moved).toEqual([
		{ id: 'function.slugify', from: 'src/utils/slugify.ts', to: 'src/core/slug.ts' }
	]);
	expect(unitOf(moved, 'function.slugify').runtime).toEqual({
		kind: 'module',
		entry: 'src/core/slug.ts',
		targets: [{ kind: 'module', entry: 'src/core/slug.ts' }, wasm]
	});
});

test('recreating retired source elsewhere records lineage to the retired identity', async () => {
	const retired = await retiredSlugify('src/utils/slugify.ts');
	const recreated = await indexFiles({ 'src/core/slug.ts': slugify }, [retired]);

	expect(recreated.result.added).toEqual(['function.slug']);
	expect(recreated.result.revived).toEqual([]);
	expect(unitOf(recreated, 'function.slug').lineage).toEqual({
		predecessors: ['function.slugify']
	});
	expect(unitOf(recreated, 'function.slugify').status).toBe('retired');
});

test('a unit that takes a retired name records lineage even when its symbols differ', async () => {
	const retired = await retiredSlugify('src/core/slugify.ts');
	const reused = await indexFiles({ 'src/utils/slugify.ts': other }, [retired]);

	expect(reused.result.added).toEqual(['function.slugify-2']);
	expect(unitOf(reused, 'function.slugify-2').lineage).toEqual({
		predecessors: ['function.slugify']
	});
});

test('lineage cannot be dropped by editing the manifest', async () => {
	const retired = await retiredSlugify('src/utils/slugify.ts');
	const recreated = await indexFiles({ 'src/core/slug.ts': slugify }, [retired]);
	const stripped: ComponentManifest = { ...unitOf(recreated, 'function.slug'), lineage: undefined };
	const edited = [retired, stripped];

	expect(registryErrors(edited, ['src/core/slug.ts'])).toEqual([
		'function.slug must record lineage to retired unit function.slugify'
	]);
	const repaired = await indexFiles({ 'src/core/slug.ts': slugify }, edited);
	expect(repaired.result.updated).toEqual(['function.slug']);
	expect(unitOf(repaired, 'function.slug').lineage).toEqual({ predecessors: ['function.slugify'] });
	expect(registryErrors(repaired.result.manifests, ['src/core/slug.ts'])).toEqual([]);

	const unknown = {
		...unitOf(repaired, 'function.slug'),
		lineage: { predecessors: ['function.gone'] }
	};
	expect(registryErrors([unknown], ['src/core/slug.ts'])).toEqual([
		'function.slug names unknown predecessor function.gone'
	]);
});

test('unrelated new units carry no lineage', async () => {
	const retired = await retiredSlugify('src/utils/slugify.ts');
	const fresh = await indexFiles({ 'src/utils/titleCase.ts': other }, [retired]);
	expect(fresh.result.added).toEqual(['function.title-case']);
	expect(unitOf(fresh, 'function.title-case').lineage).toBeUndefined();
});

test('a declared responsibility survives re-indexing while a derived one follows the unit', async () => {
	const first = unitOf(await indexFiles({ 'src/utils/slugify.ts': slugify }), 'function.slugify');
	const declared: ComponentManifest = {
		...first,
		responsibility: 'Turns a title into a URL slug.',
		responsibilityOrigin: 'declared'
	};
	const kept = await indexFiles({ 'src/utils/slugify.ts': slugify }, [declared]);
	expect(kept.result.updated).toEqual([]);
	expect(unitOf(kept, 'function.slugify').responsibility).toBe('Turns a title into a URL slug.');

	const retitled = await indexFiles({ 'src/utils/slugify.ts': slugify }, [
		{ ...first, title: 'slug' }
	]);
	expect(unitOf(retitled, 'function.slugify').responsibility).toBe(
		'Owns the slug shared function.'
	);
});

test('an alternative implementation is a related unit linked by a declared contract dependency', async () => {
	const files = {
		'src/utils/rank.ts': 'export function rank(value: number): number {\n\treturn value;\n}\n',
		'src/utils/rankFast.ts':
			'export function rankFast(value: number): number {\n\treturn value;\n}\n'
	};
	const first = await indexFiles(files);
	const link = {
		unit: 'function.rank',
		via: 'contract',
		origin: 'declared',
		contract: 'rank'
	} as const;
	const fast = { ...unitOf(first, 'function.rank-fast'), dependencies: [link] };
	const again = await indexFiles(files, [unitOf(first, 'function.rank'), fast]);

	expect(again.result.updated).toEqual([]);
	expect(unitOf(again, 'function.rank-fast').dependencies).toEqual([link]);
	const graph = new SourceGraphService().build(again.index, again.result.manifests);
	expect(graph.edges).toEqual(
		expect.arrayContaining([
			{ from: 'unit:function.rank-fast', to: 'unit:function.rank', via: 'contract' },
			{ from: 'file:src/utils/rankFast.ts', to: 'unit:function.rank', via: 'contract' }
		])
	);
});

test('several owned files produce identical metadata after one indexing pass', async () => {
	const files = {
		'src/utils/z.ts': 'export function z() { return 1; }',
		'src/utils/a.ts': 'export function a() { return 2; }',
		'src/utils/z.types.ts': 'export interface Z { value: number }'
	};
	const first = unitOf(
		await indexFiles({ 'src/utils/z.ts': files['src/utils/z.ts'] }),
		'function.z'
	);
	await assertCompanionOwnership(files, first);
});

test('recorded service moves preserve implementations and registered owner-local placement', () => {
	expect(
		new Set(services.files.map((file) => file.to)).size,
		'Each moved source has one proof'
	).toBe(services.files.length);
	const gaps = [...serviceMoveGaps(services), ...serviceMoveReviews(services)];
	expect(gaps, `service ownership: ${gaps.length} gaps; ${gaps.slice(0, 6).join('; ')}`).toEqual(
		[]
	);
	const tampered = ['corrupted pack', 'foreign commit', 'other path'];
	expect(rejectedTampering(services), 'review history admits no tampering').toEqual(tampered);
	const owner = services.files.find((file) => file.unit === 'service.unit-index')!.to;
	for (const entry of ['src/services/unit-index-service/UnitIndexService.ts', owner]) {
		const code = `const {UnitIndexService} = await import(${JSON.stringify(resolve(entry))}); console.log(JSON.stringify(new UnitIndexService().index({files: new Map()}, []).manifests));`;
		expect(
			execFileSync('bun', ['-e', code], { encoding: 'utf8', timeout: 10000 }).trim(),
			entry
		).toBe('[]');
	}
});
