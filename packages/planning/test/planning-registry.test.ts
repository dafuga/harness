import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import { getFileInfo } from 'prettier';
import { fixture, git, author, contract } from './planFixture';
const cli = resolve(import.meta.dirname, '../../../src/index.ts');
const config = {
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/'],
	global: ['custom.config'],
	ignored: ['**/*.md'],
	references: []
};
function index(root: string, write = false) {
	return JSON.parse(
		execFileSync('bun', [cli, 'units', 'index', '--json', ...(write ? ['--write'] : [])], {
			cwd: root,
			encoding: 'utf8'
		})
	);
}
async function governed() {
	const value = await fixture();
	await mkdir(join(value.root, 'src/components'), { recursive: true });
	await writeFile(
		join(value.root, 'src/components/Existing.ts'),
		'export const existing = true;\n'
	);
	await writeFile(join(value.root, 'harness.units.json'), JSON.stringify(config));
	git(value.root, 'add', '.');
	git(value.root, 'commit', '-m', 'governed source');
	index(value.root, true);
	git(value.root, 'add', '.');
	git(value.root, 'commit', '-m', 'registry');
	return value;
}
test('actual planning metadata stays outside active indexing for all five draft categories', async () => {
	const { root, api } = await governed();
	for (const category of ['page', 'component', 'function', 'service', 'config'] as const) {
		const unitId = `${category}.draft`;
		const plan = await api.createPlan({
			category,
			slug: 'draft',
			title: 'Draft',
			goal: 'Test indexing',
			author,
			contract
		});
		if (category === 'page') expect(plan.paths).toContain('harness.units.json');
		await api.addDesign({
			unitId,
			prompt: 'Test image',
			generator: { provider: 'fixture', model: 'none' },
			images: [
				{
					state: 'default',
					viewport: 'desktop',
					bytes: PNG.sync.write(new PNG({ width: 2, height: 2 }))
				}
			]
		});
		await api.openThread({
			unitId,
			version: null,
			file: null,
			imageSha256: null,
			region: null,
			author,
			message: { author, mode: 'plan', body: 'Draft discussion' }
		});
	}
	expect(index(root)).toMatchObject({ added: [], updated: [], orphaned: [], units: 1 });
	const stored = JSON.parse(await readFile(join(root, 'harness.units.json'), 'utf8'));
	expect({ ...stored, ignored: config.ignored }).toEqual(config);
	expect(stored.ignored).toContain('**/*.md');
	expect((await api.listPlans()).every((plan) => !plan.registered)).toBe(true);
	await expect(readFile(join(root, '.prettierignore'))).rejects.toMatchObject({ code: 'ENOENT' });
	expect(git(root, 'status', '--porcelain')).toBe('');
}, 90_000);
test('dirty or invalid registry configuration is never overwritten or committed', async () => {
	const { root, api } = await governed();
	const before = git(root, 'rev-parse', 'HEAD');
	const input = {
		category: 'component' as const,
		slug: 'draft',
		title: 'Draft',
		goal: 'Test config',
		author,
		contract
	};
	const dirty = JSON.stringify({ ...config, global: ['user-edit'] });
	await writeFile(join(root, 'harness.units.json'), dirty);
	await expect(api.createPlan(input)).rejects.toMatchObject({ code: 'artifact-dirty' });
	expect(await readFile(join(root, 'harness.units.json'), 'utf8')).toBe(dirty);
	expect(git(root, 'rev-parse', 'HEAD')).toBe(before);
	git(root, 'add', 'harness.units.json');
	await expect(api.createPlan(input)).rejects.toMatchObject({ code: 'artifact-dirty' });
	git(root, 'reset', '--hard', 'HEAD');
	await writeFile(join(root, 'harness.units.json'), '{}');
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'invalid registry');
	await expect(api.createPlan(input)).rejects.toMatchObject({ code: 'invalid-input' });
	expect(await api.listPlans()).toEqual([]);
}, 30_000);

test('existing formatter ignores protect immutable artifacts without hiding source', async () => {
	const { root, api } = await governed();
	const path = join(root, '.prettierignore');
	const original = '# User exclusions\ncustom-output\n';
	await writeFile(path, original);
	git(root, 'add', '.prettierignore');
	git(root, 'commit', '-m', 'formatter configuration');
	const input = {
		category: 'component' as const,
		slug: 'draft',
		title: 'Draft',
		goal: 'Immutable formatting',
		author,
		contract
	};
	const result = await api.createPlan(input);
	expect(result.paths).toContain('.prettierignore');
	const content = await readFile(path, 'utf8');
	expect(content.startsWith(original)).toBe(true);
	for (const category of ['pages', 'components', 'functions', 'services', 'configs']) {
		for (const name of [
			'plan.json',
			'designs/v001/design.json',
			'designs/v001/prompt.md',
			'designs/v001/notes.md',
			'designs/approvals/id.json',
			'threads/id/thread.json'
		]) {
			expect(
				(await getFileInfo(join(root, 'src', category, 'draft', name), { ignorePath: path }))
					.ignored
			).toBe(true);
		}
		for (const name of ['implementation.ts', 'config.json', 'README.md', 'designs/v001/code.ts']) {
			expect(
				(await getFileInfo(join(root, 'src', category, 'draft', name), { ignorePath: path }))
					.ignored
			).toBe(false);
		}
	}
	await api.createPlan({ ...input, slug: 'second' });
	expect(await readFile(path, 'utf8')).toBe(content);
	expect(git(root, 'status', '--porcelain')).toBe('');
}, 30_000);
test('dirty formatter ignores refuse planning without changing repository state', async () => {
	const { root, api } = await governed();
	const path = join(root, '.prettierignore');
	await writeFile(path, '# Original\n');
	git(root, 'add', '.prettierignore');
	git(root, 'commit', '-m', 'formatter configuration');
	await writeFile(path, '# Staged user change\n');
	git(root, 'add', '.prettierignore');
	await writeFile(path, '# Unstaged user change\n');
	const before = [git(root, 'rev-parse', 'HEAD'), git(root, 'diff', '--cached'), git(root, 'diff')];
	await expect(
		api.createPlan({
			category: 'page',
			slug: 'draft',
			title: 'Draft',
			goal: 'Preserve configuration',
			author,
			contract
		})
	).rejects.toMatchObject({ code: 'artifact-dirty' });
	expect([
		git(root, 'rev-parse', 'HEAD'),
		git(root, 'diff', '--cached'),
		git(root, 'diff')
	]).toEqual(before);
	expect(await readFile(path, 'utf8')).toBe('# Unstaged user change\n');
	expect(await api.listPlans()).toEqual([]);
}, 30_000);
