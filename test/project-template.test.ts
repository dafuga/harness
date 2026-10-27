import { format, type Options } from 'prettier';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { projectFiles } from '../src/templates/project';
import { measureWorkload } from './support/measureWorkload';
import { assertFoundationLint } from './support/project-template/foundations';
import { assertAtomCompiler } from './support/project-template/atoms';
import {
	expectGeneratedGuidance,
	expectCatalogGuidance,
	expectStaticCheckOrder,
	expectAppTypeReference,
	expectInitialPageViewports,
	expectGeneratedLibraryExample
} from './support/project-template/guidance';

test(
	'generated element atoms preserve native compilation and emitted runtime source',
	assertAtomCompiler
);

test('app projects include SvelteKit and specification files', () =>
	measureWorkload('template.project-guidance', 'layout-catalog-behavior', async () => {
		const files = await measureWorkload('template.project', 'static-before-visual-app-plan', () =>
			projectFiles({ kind: 'app', name: 'demo-app' })
		);
		const paths = files.map((file) => file.path);
		const packageJson = JSON.parse(fileContents(files, 'package.json'));
		const initialPageTest = fileContents(files, 'tests/e2e/app.spec.ts');
		expect(paths).toContain('svelte.config.js');
		expect(paths).toContain('playwright.config.ts');
		expect(paths).toContain('tests/e2e/app.spec.ts');
		expect(paths, 'The initial page must declare its standard screenshot cases').toContain(
			'specification/units/page.root.json'
		);
		expect(paths).not.toContain('test/smoke.test.ts');
		expect(initialPageTest).toContain("from './support/browserTest'");
		expect(initialPageTest).toContain("test('app page initial state'");
		expect(initialPageTest).toContain("await page.goto('/')");
		await expectInitialPageViewports(files);
		expect(paths).toContain('eslint.config.js');
		expect(paths).toContain('eslint.harness-rules.js');
		expect(paths).toContain('harness.audit.json');
		expect(paths).toContain('.prettierrc');
		expect(paths).toContain('.prettierignore');
		expect(paths).toContain('scripts/harness-audit.ts');
		expect(paths).toContain('src/app.html');
		expect(paths).toContain('specification/README.md');
		expect(paths).toContain('.codex/skills/harness/SKILL.md');
		expect(fileContents(files, 'AGENTS.md')).toContain('Treat Harness as the operating contract');
		expect(fileContents(files, 'AGENTS.md')).toContain('bun run check');
		expectResourceGuidance(files);
		expect(fileContents(files, '.codex/skills/harness/SKILL.md')).toContain(
			'Use this skill whenever'
		);
		expect(fileContents(files, '.codex/skills/harness/SKILL.md')).toContain(
			'harness info scaffolds --json'
		);
		expectCatalogGuidance(files);
		await measureWorkload('function.bug-repair-policy', 'layout-page-agent-guidance', () =>
			expectGeneratedGuidance(files)
		);
		expect(auditConfig(files).limits.maxMethodLines).toBe(35);
		expect(packageJson.harness.kind).toBe('app');
		expect(packageJson.scripts['test:e2e']).toBe('playwright test');
		expect(packageJson.scripts.audit).toContain('harness-audit');
		expect(packageJson.scripts.check).toContain('format:check');
		expect(packageJson.scripts.check).toContain('audit');
		expectStaticCheckOrder(packageJson.scripts.check);
		expectAppTypeReference(files);
		expect(packageJson.scripts['format:check']).toContain('prettier --check');
		expect(packageJson.scripts.lint).toContain('eslint');
		expect(packageJson.scripts.typecheck).toContain('svelte-check');
		expect(packageJson.devDependencies.eslint).toBeDefined();
		expect(packageJson.devDependencies.prettier).toBeDefined();
	}));

test('library projects include Bun TypeScript test structure', async () => {
	const files = await measureWorkload('template.project', 'library-authored-example', () =>
		measureWorkload('template.project-tests', 'library-authored-example', () =>
			projectFiles({ kind: 'lib', name: 'demo-lib' })
		)
	);
	const paths = files.map((file) => file.path);
	const packageJson = JSON.parse(
		files.find((file) => file.path === 'package.json')?.contents ?? '{}'
	);

	expect(paths).toContain('src/index.ts');
	expect(paths).toContain('eslint.config.js');
	expect(paths).toContain('eslint.harness-rules.js');
	expect(paths).toContain('harness.audit.json');
	expect(paths).toContain('.prettierrc');
	expect(paths).toContain('.prettierignore');
	expect(paths).toContain('scripts/harness-audit.ts');
	expect(paths).toContain('test/index.test.ts');
	await expectGeneratedLibraryExample(files);
	expect(paths).toContain('tsconfig.json');
	expect(paths).toContain('.codex/skills/harness/SKILL.md');
	expect(fileContents(files, 'AGENTS.md')).toContain('Treat Harness as the operating contract');
	expect(fileContents(files, '.codex/skills/harness/SKILL.md')).toContain('bun run check');
	expect(auditConfig(files).limits.maxFileLines).toBe(220);
	for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
		expect(fileContents(files, path)).toContain('harness info naming');
		expect(fileContents(files, path)).toContain('<PascalName>Service.ts');
		expect(fileContents(files, path)).toContain('<camelName>.ts');
		expect(fileContents(files, path)).toContain('instantiated classes');
	}
	expectGeneratedGuidance(files);
	expect(packageJson.harness.kind).toBe('lib');
	expect(packageJson.scripts.audit).toContain('harness-audit');
	expect(packageJson.scripts.check).toContain('format:check');
	expect(packageJson.scripts.check).toContain('audit');
	expect(packageJson.scripts['format:check']).toContain('prettier --check');
	expect(packageJson.scripts.test).toBe('bun run test:unit');
	expect(packageJson.scripts.typecheck).toBe('tsc --noEmit');
	expect(packageJson.devDependencies['@typescript-eslint/parser']).toBeDefined();
	expect(packageJson.devDependencies.prettier).toBeDefined();
});

test.each(['app', 'lib'] as const)(
	'generated %s code and configuration obey their formatter settings',
	async (kind) => {
		const files = projectFiles({ kind, name: 'format-proof' });
		await assertFoundationLint(files, kind);
		const options = JSON.parse(fileContents(files, '.prettierrc')) as Options;
		for (const file of files.filter((file) => /\.(js|ts|json)$/.test(file.path))) {
			expect(file.contents, file.path).toBe(
				await format(file.contents, { ...options, filepath: file.path })
			);
		}
	}
);

function fileContents(files: ReturnType<typeof projectFiles>, path: string): string {
	return files.find((file) => file.path === path)?.contents ?? '';
}

function auditConfig(files: ReturnType<typeof projectFiles>): { limits: Record<string, number> } {
	return JSON.parse(fileContents(files, 'harness.audit.json')) as {
		limits: Record<string, number>;
	};
}

function expectResourceGuidance(files: ReturnType<typeof projectFiles>): void {
	expect(fileContents(files, 'AGENTS.md')).toContain('harness resources run');
	expect(fileContents(files, 'AGENTS.md')).toContain('Finish current tests under pressure');
}
