import { expect, test } from 'vitest';
import { projectFiles } from '../src/templates/project';

test('app projects include SvelteKit and specification files', () => {
	const files = projectFiles({ kind: 'app', name: 'demo-app' });
	const paths = files.map((file) => file.path);
	const packageJson = JSON.parse(
		files.find((file) => file.path === 'package.json')?.contents ?? '{}'
	);

	expect(paths).toContain('svelte.config.js');
	expect(paths).toContain('playwright.config.ts');
	expect(paths).toContain('eslint.config.js');
	expect(paths).toContain('eslint.harness-rules.js');
	expect(paths).toContain('.prettierrc');
	expect(paths).toContain('.prettierignore');
	expect(paths).toContain('scripts/harness-audit.ts');
	expect(paths).toContain('scripts/harness-verify.ts');
	expect(paths).toContain('src/app.html');
	expect(paths).toContain('specification/README.md');
	expect(packageJson.harness.kind).toBe('app');
	expect(packageJson.scripts['test:e2e']).toBe('playwright test');
	expect(packageJson.scripts.audit).toContain('harness-audit');
	expect(packageJson.scripts['format:check']).toContain('prettier --check');
	expect(packageJson.scripts.lint).toContain('eslint');
	expect(packageJson.scripts.verify).toContain('harness-verify');
	expect(packageJson.devDependencies.eslint).toBeDefined();
	expect(packageJson.devDependencies.prettier).toBeDefined();
});

test('library projects include Bun TypeScript test structure', () => {
	const files = projectFiles({ kind: 'lib', name: 'demo-lib' });
	const paths = files.map((file) => file.path);
	const packageJson = JSON.parse(
		files.find((file) => file.path === 'package.json')?.contents ?? '{}'
	);

	expect(paths).toContain('src/index.ts');
	expect(paths).toContain('eslint.config.js');
	expect(paths).toContain('eslint.harness-rules.js');
	expect(paths).toContain('.prettierrc');
	expect(paths).toContain('.prettierignore');
	expect(paths).toContain('scripts/harness-audit.ts');
	expect(paths).toContain('scripts/harness-verify.ts');
	expect(paths).toContain('test/index.test.ts');
	expect(paths).toContain('tsconfig.json');
	expect(packageJson.harness.kind).toBe('lib');
	expect(packageJson.scripts.audit).toContain('harness-audit');
	expect(packageJson.scripts['format:check']).toContain('prettier --check');
	expect(packageJson.scripts.test).toBe('bun run test:unit');
	expect(packageJson.scripts.verify).toContain('harness-verify');
	expect(packageJson.devDependencies['@typescript-eslint/parser']).toBeDefined();
	expect(packageJson.devDependencies.prettier).toBeDefined();
});
