import { expect, test } from 'vitest';
import { projectFiles } from '../src/templates/project';

test('app projects include SvelteKit and specification files', () => {
	const files = projectFiles({ kind: 'app', name: 'demo-app' });
	const paths = files.map((file) => file.path);
	const packageJson = JSON.parse(files.find((file) => file.path === 'package.json')?.contents ?? '{}');

	expect(paths).toContain('svelte.config.js');
	expect(paths).toContain('playwright.config.ts');
	expect(paths).toContain('eslint.config.js');
	expect(paths).toContain('eslint.frame-rules.js');
	expect(paths).toContain('src/app.html');
	expect(paths).toContain('specification/README.md');
	expect(packageJson.frame.kind).toBe('app');
	expect(packageJson.scripts['test:e2e']).toBe('playwright test');
	expect(packageJson.scripts.lint).toContain('eslint');
	expect(packageJson.scripts.verify).toContain('bun run lint');
	expect(packageJson.devDependencies.eslint).toBeDefined();
});

test('library projects include Bun TypeScript test structure', () => {
	const files = projectFiles({ kind: 'lib', name: 'demo-lib' });
	const paths = files.map((file) => file.path);
	const packageJson = JSON.parse(files.find((file) => file.path === 'package.json')?.contents ?? '{}');

	expect(paths).toContain('src/index.ts');
	expect(paths).toContain('eslint.config.js');
	expect(paths).toContain('eslint.frame-rules.js');
	expect(paths).toContain('test/index.test.ts');
	expect(paths).toContain('tsconfig.json');
	expect(packageJson.frame.kind).toBe('lib');
	expect(packageJson.scripts.test).toBe('bun run test:unit');
	expect(packageJson.scripts.verify).toContain('bun run lint');
	expect(packageJson.devDependencies['@typescript-eslint/parser']).toBeDefined();
});
