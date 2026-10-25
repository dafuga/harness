import { format, type Options } from 'prettier';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { projectFiles } from '../src/templates/project';
import { measureWorkload } from './support/measureWorkload';
import { assertAtomCompiler } from './support/project-template/atoms';

test(
	'generated element atoms preserve native compilation and emitted runtime source',
	assertAtomCompiler
);

test('app projects include SvelteKit and specification files', () =>
	measureWorkload('template.project-guidance', 'layout-catalog-behavior', () => {
		const files = projectFiles({ kind: 'app', name: 'demo-app' });
		const paths = files.map((file) => file.path);
		const packageJson = JSON.parse(fileContents(files, 'package.json'));
		const initialPageTest = fileContents(files, 'tests/e2e/app.spec.ts');
		expect(paths).toContain('svelte.config.js');
		expect(paths).toContain('playwright.config.ts');
		expect(paths).toContain('tests/e2e/app.spec.ts');
		expect(paths).not.toContain('test/smoke.test.ts');
		expect(files.find((file) => file.path === 'playwright.config.ts')?.contents).toContain(
			"updateSnapshots: 'none'"
		);
		expect(initialPageTest).toContain("from './support/browserTest'");
		expect(initialPageTest).toContain("test('app page initial state'");
		expect(initialPageTest).toContain("await page.goto('/')");
		expect(initialPageTest).toContain("matchScreenshot(page, 'initial.png', { fullPage: true })");
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
		for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
			expect(fileContents(files, path)).toContain('Callable usage examples');
			expect(fileContents(files, path)).toContain('General text helpers belong in Strings');
			expect(fileContents(files, path)).toContain(
				'reusable visual frames with a child-content slot'
			);
			expect(fileContents(files, path)).toContain('Child content');
			expect(fileContents(files, path)).toContain(
				'Full-frame previews own their content boundaries'
			);
			expect(fileContents(files, path), 'Behavior-focused example guidance').toContain(
				'one representative example per distinct behavior'
			);
			expect(fileContents(files, path)).toContain('descriptive behavior titles');
			expect(fileContents(files, path)).toContain('src/helpers/<responsibility>/<camelName>.ts');
			expect(fileContents(files, path)).toContain('selected callable implementation');
		}
		expectGeneratedGuidance(files);
		expect(auditConfig(files).limits.maxMethodLines).toBe(35);
		expect(packageJson.harness.kind).toBe('app');
		expect(packageJson.scripts['test:e2e']).toBe('playwright test');
		expect(packageJson.scripts.audit).toContain('harness-audit');
		expect(packageJson.scripts.check).toContain('format:check');
		expect(packageJson.scripts.check).toContain('audit');
		expect(packageJson.scripts['format:check']).toContain('prettier --check');
		expect(packageJson.scripts.lint).toContain('eslint');
		expect(packageJson.scripts.typecheck).toContain('svelte-check');
		expect(packageJson.devDependencies.eslint).toBeDefined();
		expect(packageJson.devDependencies.prettier).toBeDefined();
	}));

test('library projects include Bun TypeScript test structure', () => {
	const files = projectFiles({ kind: 'lib', name: 'demo-lib' });
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
		const options = JSON.parse(fileContents(files, '.prettierrc')) as Options;
		for (const file of files.filter((file) => /\.(js|ts|json)$/.test(file.path))) {
			expect(file.contents, file.path).toBe(
				await format(file.contents, { ...options, filepath: file.path })
			);
		}
	}
);

function expectGeneratedGuidance(files: ReturnType<typeof projectFiles>): void {
	expectRenameGuidance(files);
	expectStandardTestForms(files);
}

function expectRenameGuidance(files: ReturnType<typeof projectFiles>): void {
	for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
		expect(fileContents(files, path)).toContain(
			'Group related list, detail and history pages by feature'
		);
		expect(fileContents(files, path)).toContain(
			'use route groups when public URLs must stay unchanged'
		);
		expect(fileContents(files, path)).toContain('Persisted data wrappers belong under Models');
		expect(fileContents(files, path)).toContain('shared type modules belong under Types');
		expect(fileContents(files, path)).toContain('Omit .types from displayed names');
		expect(fileContents(files, path)).toContain('canonical and compatibility titles and links');
		expect(fileContents(files, path)).toContain(
			'affected downstream consumer tests alongside their typechecks'
		);
		expect(fileContents(files, path)).toContain('affected package lint and audit');
		expect(fileContents(files, path)).toContain(
			'important controls a user, operator or app developer'
		);
		expect(fileContents(files, path)).toContain('exact source, name, audience and purpose');
		expect(fileContents(files, path)).toContain('design tokens belong in Styles');
	}
}

function expectStandardTestForms(files: ReturnType<typeof projectFiles>): void {
	for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
		const text = fileContents(files, path);
		expect(text, path).toContain('Write tests only in the five standard forms');
		expect(text, path).toContain('## Standard Test Forms');
		expect(text, path).toContain('Use exactly these five forms');
		expect(text, path).toContain(
			'Pages: Playwright screenshot matches of each declared page state'
		);
		expect(text, path).toContain(
			'Components: Playwright screenshot matches of the component at rest'
		);
		expect(text, path).toContain('Helpers: one unit case per authored example');
		expect(text, path).toContain(
			'Classes: one case per method and declared initialization or lifecycle state'
		);
		expect(text, path).toContain('APIs: structural complete JSON response matches');
		expect(text, path).toContain('Interaction, accessibility and console assertions stay inside');
		expect(text, path).toContain('Do not add a sixth shape');
		expect(text, path).toContain('Projects without UI have no page or component cases');
		expect(text, path).toContain('Do not auto-accept screenshot baselines');
		expect(text, path).toContain('fails explicitly');
		expect(text, path).not.toContain('Keep exhaustive boundary cases in tests');
	}
}

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
