import { expect, test } from 'vitest';
import { projectFiles } from '../src/templates/project';

test('app projects include SvelteKit and specification files', () => {
	const files = projectFiles({ kind: 'app', name: 'demo-app' });
	const paths = files.map((file) => file.path);

	expect(paths).toContain('svelte.config.js');
	expect(paths).toContain('src/app.html');
	expect(paths).toContain('specification/README.md');
});

test('library projects include Bun TypeScript test structure', () => {
	const files = projectFiles({ kind: 'lib', name: 'demo-lib' });
	const paths = files.map((file) => file.path);

	expect(paths).toContain('src/index.ts');
	expect(paths).toContain('test/index.test.ts');
	expect(paths).toContain('tsconfig.json');
});
