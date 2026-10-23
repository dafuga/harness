import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import migration from '../specification/loops/local-helper-ownership/migration.json';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { appendMissingExports, applyExports } from '../src/workflows/generate-code/exports';
import { detectProjectKind } from '../src/workflows/generate-code/project';

test('detects explicit Harness project kinds', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-project-'));
	await writeFile(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'app' } }));

	expect(await detectProjectKind(root)).toBe('app');
	await rm(root, { recursive: true, force: true });
});

test('detects app and lib projects from local files', async () => {
	const app = await mkdtemp(join(tmpdir(), 'harness-project-'));
	await writeFile(
		join(app, 'package.json'),
		JSON.stringify({ devDependencies: { '@sveltejs/kit': '^2' } })
	);
	expect(await detectProjectKind(app)).toBe('app');

	const lib = await mkdtemp(join(tmpdir(), 'harness-project-'));
	await mkdir(join(lib, 'src'));
	await writeFile(join(lib, 'src/index.ts'), '');
	await writeFile(join(lib, 'package.json'), JSON.stringify({ type: 'module' }));
	expect(await detectProjectKind(lib)).toBe('lib');

	await rm(app, { recursive: true, force: true });
	await rm(lib, { recursive: true, force: true });
});

test('appends missing exports idempotently', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-exports-'));
	await mkdir(join(root, 'src'));
	await writeFile(join(root, 'src/index.ts'), 'export const existing = true;\n');

	const changed = await applyExports(root, [
		{ source: './services/PostService', named: ['PostService'] }
	]);
	const unchanged = await applyExports(root, [
		{ source: './services/PostService', named: ['PostService'] }
	]);

	expect(changed).toBe(true);
	expect(unchanged).toBe(false);
	expect(appendMissingExports('', [{ source: './models/Post', named: ['Post'] }])).toBe(
		"export { Post } from './models/Post';\n"
	);

	const occupied =
		"export { formatDate } from './utils/formatDate';\nexport const formatDateHelper = true;\n";
	const helper = [{ source: './helpers/strings/formatDate', named: ['formatDate'] }];
	const merged = appendMissingExports(occupied, helper);
	expect(merged, 'A helper keeps an existing package export intact').toContain(
		"export { formatDate as formatDateHelper2 } from './helpers/strings/formatDate';"
	);
	expect(merged.startsWith(occupied)).toBe(true);
	expect(appendMissingExports(merged, helper)).toBe(merged);
	await rm(root, { recursive: true, force: true });
});

for (const module of migration.publicModules) {
	test(`${module.unit} keeps its callable API at its owner-layer runtime entry`, () => {
		const unit = JSON.parse(readFileSync(`specification/units/${module.unit}.json`, 'utf8'));
		expect(unit.runtime.entry).toBe(module.entry);
		expect(
			unit.runtime.targets.every((target: { entry: string }) => target.entry === module.entry)
		).toBe(true);
		const command = `const module = await import(${JSON.stringify('./' + module.entry)}); console.log(JSON.stringify(${JSON.stringify(module.exports)}.map(name => typeof module[name])));`;
		const types = JSON.parse(execFileSync('bun', ['-e', command], { encoding: 'utf8' }));
		expect(types).toEqual(module.exports.map(() => 'function'));
	});
}
