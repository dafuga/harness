import { afterEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { auditHarnessStructure } from '../src/audit/structureRules';
import { auditPath } from '../src/audit/audit';
import { canonicalJson } from '../src/utils/canonicalJson';
const roots: string[] = [];
afterEach(async () => {
	await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
	roots.length = 0;
});
async function fixture(category = 'page') {
	const root = await mkdtemp(join(tmpdir(), 'harness-plan-structure-'));
	roots.push(root);
	const path = `src/${category}s/example`;
	const contract = {
		responsibility: 'Display events',
		inputs: [],
		outputs: [],
		errors: [],
		states: ['default'],
		viewports: ['desktop']
	};
	const plan = {
		unitId: `${category}.example`,
		category,
		slug: 'example',
		path,
		title: 'Example',
		goal: 'Review events',
		createdAt: '2026-10-11T00:00:00.000Z',
		createdBy: { kind: 'person', name: 'Fixture' },
		baseRevision: 'a'.repeat(40),
		contract,
		contractHash: createHash('sha256').update(canonicalJson(contract)).digest('hex')
	};
	await mkdir(join(root, path, 'designs/v001'), { recursive: true });
	await mkdir(join(root, path, 'threads/550e8400-e29b-41d4-a716-446655440000'), {
		recursive: true
	});
	await writeFile(join(root, path, 'plan.json'), JSON.stringify(plan));
	for (const file of [
		'designs/v001/design.json',
		'designs/v001/prompt.md',
		'designs/v001/notes.md',
		'threads/550e8400-e29b-41d4-a716-446655440000/thread.json',
		'threads/550e8400-e29b-41d4-a716-446655440000/messages.ndjson'
	])
		await writeFile(join(root, path, file), '{}');
	await writeFile(
		join(root, path, '.gitattributes'),
		'designs/**/*.png filter=lfs diff=lfs merge=lfs -text\n'
	);
	return { root, path, plan };
}
test.each(['page', 'component', 'function', 'config', 'service'])(
	'validated %s planning artifact shapes pass structural audit',
	async (category) => {
		const { root } = await fixture(category);
		expect(await auditPath(root, { profile: 'lib' })).toEqual([]);
	}
);
test('planning metadata never exempts hidden implementation or unknown artifact folders', async () => {
	const { root, path } = await fixture();
	await mkdir(join(root, path, 'designs/v001/hidden'), { recursive: true });
	await writeFile(join(root, path, 'designs/v001/hidden/code.ts'), 'export const hidden = true;');
	await writeFile(join(root, path, 'designs/v001/code.ts'), 'export const hidden = true;');
	await writeFile(join(root, path, 'implementation.ts'), 'export const hidden = true;');
	const findings = await auditPath(root, { profile: 'lib' });
	for (const file of ['designs/v001/hidden/code.ts', 'designs/v001/code.ts', 'implementation.ts'])
		expect(findings).toContainEqual(
			expect.objectContaining({ path: `${path}/${file}`, rule: 'harness-source-structure' })
		);
});

test('reserved artifacts cannot hide code under an otherwise supported scaffold folder', async () => {
	const { root, path } = await fixture('component');
	await writeFile(join(root, path, 'designs/v001/hidden.ts'), 'export const hidden = true;');
	await writeFile(join(root, path, 'implementation.ts'), '\n'.repeat(222));
	const findings = await auditPath(root, { profile: 'lib' });
	expect(findings).toContainEqual(
		expect.objectContaining({
			path: `${path}/designs/v001/hidden.ts`,
			rule: 'harness-source-structure'
		})
	);
	expect(findings).toContainEqual(
		expect.objectContaining({ path: `${path}/implementation.ts`, rule: 'small-file' })
	);
});

async function canonicalFixture(category = 'page') {
	const value = await fixture(category);
	const unitId = `example.${category}.canonical`;
	const manifest = {
		schemaVersion: 1,
		id: unitId,
		kind: category,
		title: 'Canonical',
		responsibility: 'Display events',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'src/index.ts',
			targets: [{ kind: 'module', entry: 'src/index.ts' }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
	await mkdir(join(value.root, 'specification/units'), { recursive: true });
	const manifestPath = join(value.root, `specification/units/${unitId}.json`);
	await writeFile(manifestPath, JSON.stringify(manifest));
	await writeFile(
		join(value.root, value.path, 'plan.json'),
		JSON.stringify({ ...value.plan, unitId })
	);
	return { ...value, manifest, manifestPath };
}
test('a valid plan exempts shared ancestors without admitting unrelated siblings or directories', async () => {
	const { root } = await fixture();
	await mkdir(join(root, 'src/pages/unrelated'), { recursive: true });
	await mkdir(join(root, 'src/pages/unknown-empty'), { recursive: true });
	await writeFile(join(root, 'src/pages/unrelated/code.ts'), 'export const code = true;');
	await writeFile(join(root, 'src/pages/sibling.ts'), 'export const code = true;');
	const findings = await auditPath(root, { profile: 'lib' });
	expect(findings.some((finding) => finding.path === 'src/pages/')).toBe(false);
	for (const path of [
		'src/pages/unrelated/',
		'src/pages/unknown-empty/',
		'src/pages/unrelated/code.ts',
		'src/pages/sibling.ts'
	]) {
		expect(findings).toContainEqual(
			expect.objectContaining({ path, rule: 'harness-source-structure' })
		);
	}
});
test.each(['page', 'component', 'service'])(
	'valid canonical %s metadata does not mask implementation in artifact folders',
	async (category) => {
		const { root, path } = await canonicalFixture(category);
		expect(await auditPath(root, { profile: 'lib' })).toEqual([]);
		const files = [
			'designs/v001/hidden.ts',
			'threads/550e8400-e29b-41d4-a716-446655440000/hidden.ts'
		];
		for (const file of files) await writeFile(join(root, path, file), 'export const code = true;');
		const findings = await auditPath(root, { profile: 'lib' });
		for (const file of files)
			expect(findings).toContainEqual(
				expect.objectContaining({ path: `${path}/${file}`, rule: 'harness-source-structure' })
			);
	}
);
test.each(['page', 'component', 'function', 'config', 'service'])(
	'wrong-kind and corrupt %s canonical manifests cannot attest planning metadata',
	async (category) => {
		const { root, path, manifestPath, manifest } = await canonicalFixture(category);
		for (const content of [
			JSON.stringify({ ...manifest, kind: category === 'service' ? 'component' : 'service' }),
			'{broken',
			JSON.stringify({ id: manifest.id, kind: 'page' })
		]) {
			await writeFile(manifestPath, content);
			expect(await auditPath(root, { profile: 'lib' })).toContainEqual(
				expect.objectContaining({ path: `${path}/plan.json`, rule: 'harness-source-structure' })
			);
		}
	}
);

test.each(['component', 'function', 'service'])(
	'missing or corrupt %s plans cannot disable reserved subtree checks',
	async (category) => {
		const { root, path, plan } = await fixture(category);
		const hidden = `${path}/designs/v001/hidden.ts`;
		const thread = `${path}/threads/unknown/hidden.bin`;
		const source = 'src/components/ordinary/index.ts';
		const files = [`${path}/plan.json`, hidden, thread, source];
		const dirs = ['src/', `src/${category}s/`, `${path}/`];
		dirs.push(
			...['designs/', 'designs/v001/', 'designs/empty/'].map((suffix) => `${path}/${suffix}`)
		);
		for (const content of [
			JSON.stringify({ ...plan, path: 'src/pages/other' }),
			JSON.stringify({ ...plan, contractHash: 'b'.repeat(64) }),
			JSON.stringify({ ...plan, unitId: 'missing.canonical' }),
			'{"broken":true}',
			'{broken',
			null
		]) {
			if (content === null) await rm(join(root, path, 'plan.json'));
			else await writeFile(join(root, path, 'plan.json'), content);
			const findings = auditHarnessStructure({
				root,
				files: content === null ? files.slice(1) : files,
				dirs,
				profile: 'lib'
			});
			for (const file of [
				hidden,
				thread,
				`${path}/designs/empty/`,
				...(content === null ? [] : [`${path}/plan.json`])
			])
				expect(findings).toContainEqual(
					expect.objectContaining({ path: file, rule: 'harness-source-structure' })
				);
			expect(findings.some((finding) => finding.path === source)).toBe(false);
		}
	}
);
