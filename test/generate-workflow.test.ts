import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { generateModel, generatePiece } from '../src/workflows/generateCode';

test('lib generation auto-exports package-safe scaffolds', async () => {
	const root = await libProject();

	await generatePiece({ root, kind: 'service', name: 'PublishPost' });
	await generatePiece({ root, kind: 'mailer', name: 'Welcome' });
	await generatePiece({ root, kind: 'concern', name: 'Publishable' });
	await generatePiece({ root, kind: 'config', name: 'Search' });
	await generateModel({ root, name: 'Post', rawFields: ['title:string'], adapter: 'sqlite' });

	const index = await readFile(join(root, 'src/index.ts'), 'utf8');
	expect(index).toContain("export { PublishPostService } from './services/PublishPostService';");
	expect(index).toContain("export { WelcomeMailer } from './mailers/WelcomeMailer';");
	expect(index).toContain("export { withPublishable } from './concerns/withPublishable';");
	expect(index).toContain("export { searchConfig } from './config/searchConfig';");
	expect(index).toContain("export { Post } from './models/Post';");
	expect(index).toContain('export type { PostAttributes, PostCreateInput, PostUpdateInput }');
	await rm(root, { recursive: true, force: true });
});

test('app-only scaffolds fail in lib projects', async () => {
	const root = await libProject();

	await expect(generatePiece({ root, kind: 'view', name: 'Dashboard' })).rejects.toThrow(
		'only available in Harness app projects'
	);
	await rm(root, { recursive: true, force: true });
});

test('app generation allows app-only scaffolds without package exports', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-generate-'));
	await writeFile(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'app' } }));

	const result = await generatePiece({ root, kind: 'view', name: 'Dashboard' });

	expect(result.writes.map((file) => file.path)).toContain('src/routes/dashboard/+page.svelte');
	expect(result.exportsUpdated).toBe(false);
	await rm(root, { recursive: true, force: true });
});

async function libProject(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'harness-generate-'));
	await mkdir(join(root, 'src'), { recursive: true });
	await writeFile(join(root, 'src/index.ts'), '');
	await writeFile(join(root, 'package.json'), JSON.stringify({ harness: { kind: 'lib' } }));
	return root;
}
