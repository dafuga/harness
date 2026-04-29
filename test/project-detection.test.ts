import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { appendMissingExports, applyExports } from '../src/core/exports';
import { detectProjectKind } from '../src/core/project';

test('detects explicit Frame project kinds', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-project-'));
	await writeFile(join(root, 'package.json'), JSON.stringify({ frame: { kind: 'app' } }));

	expect(await detectProjectKind(root)).toBe('app');
	await rm(root, { recursive: true, force: true });
});

test('detects app and lib projects from local files', async () => {
	const app = await mkdtemp(join(tmpdir(), 'frame-project-'));
	await writeFile(join(app, 'package.json'), JSON.stringify({ devDependencies: { '@sveltejs/kit': '^2' } }));
	expect(await detectProjectKind(app)).toBe('app');

	const lib = await mkdtemp(join(tmpdir(), 'frame-project-'));
	await mkdir(join(lib, 'src'));
	await writeFile(join(lib, 'src/index.ts'), '');
	await writeFile(join(lib, 'package.json'), JSON.stringify({ type: 'module' }));
	expect(await detectProjectKind(lib)).toBe('lib');

	await rm(app, { recursive: true, force: true });
	await rm(lib, { recursive: true, force: true });
});

test('appends missing exports idempotently', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-exports-'));
	await mkdir(join(root, 'src'));
	await writeFile(join(root, 'src/index.ts'), "export const existing = true;\n");

	const changed = await applyExports(root, [{ source: './services/PostService', named: ['PostService'] }]);
	const unchanged = await applyExports(root, [{ source: './services/PostService', named: ['PostService'] }]);

	expect(changed).toBe(true);
	expect(unchanged).toBe(false);
	expect(appendMissingExports('', [{ source: './models/Post', named: ['Post'] }])).toBe(
		"export { Post } from './models/Post';\n"
	);
	await rm(root, { recursive: true, force: true });
});
