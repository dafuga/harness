import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { format, type Options } from 'prettier';
import { test } from 'vitest';
import { expect } from './verificationExpect';
import { createProject } from '../src/cli/program/create-project/createProject';
import { projectFiles } from '../src/templates/projects-sessions/project';
import { measureWorkload } from './support/measureWorkload';
import { assertFoundationLint } from './support/project-template/foundations';
import { assertAtomCompiler } from './support/project-template/atoms';
import { assertHarnessCliGuidance } from './support/harnessCliGuidance';
import { withTempDir } from './support/temporary';

test(
	'generated element atoms preserve native compilation and emitted runtime source',
	assertAtomCompiler
);

test('app projects include SvelteKit and specification files', () =>
	measureWorkload('template.project-guidance', 'layout-catalog-behavior', () => {
		const files = projectFiles({ kind: 'app', name: 'demo-app' });
		const paths = files.map((file) => file.path);
		const packageJson = JSON.parse(fileContents(files, 'package.json'));
		expect(paths).toContain('svelte.config.js');
		expect(paths).toContain('playwright.config.ts');
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
		expectAgentGuidance(files);
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
	expectAgentGuidance(files);
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

test('static apps scaffold a prerendered build while default apps use adapter-auto', () =>
	measureWorkload('template.project', 'static-app-scaffold', () => {
		const staticFiles = projectFiles({ kind: 'app', name: 'static-app', adapter: 'static' });
		const staticPackage = JSON.parse(fileContents(staticFiles, 'package.json'));
		expect(staticPackage.devDependencies['@sveltejs/adapter-static']).toBeDefined();
		expect(staticPackage.devDependencies['@sveltejs/adapter-auto']).toBeUndefined();
		const staticConfig = fileContents(staticFiles, 'svelte.config.js');
		expect(staticConfig).toContain("'@sveltejs/adapter-static'");
		expect(staticConfig).toContain("adapter({ pages: 'build', assets: 'build' })");
		expect(fileContents(staticFiles, 'src/routes/+layout.ts')).toBe(
			'export const prerender = true;\n'
		);

		const defaults = projectFiles({ kind: 'app', name: 'default-app' });
		expect(JSON.parse(fileContents(defaults, 'package.json')).devDependencies).toHaveProperty([
			'@sveltejs/adapter-auto'
		]);
		expect(fileContents(defaults, 'svelte.config.js')).toContain("'@sveltejs/adapter-auto'");
		expect(defaults.some((file) => file.path === 'src/routes/+layout.ts')).toBe(false);
	}));

test('project creation writes a static app and rejects unsupported adapter requests before writing', () =>
	withTempDir('harness-static-app-', async (root) => {
		const created = await measureWorkload(
			'workflow.create-project',
			'create-static-app-files',
			() => createProject({ kind: 'app', name: 'static-app', parent: root, adapter: 'static' })
		);
		expect(created.writes.some((file) => file.path === 'src/routes/+layout.ts')).toBe(true);
		expect(await readFile(join(root, 'static-app/src/routes/+layout.ts'), 'utf8')).toBe(
			'export const prerender = true;\n'
		);
		await expect(
			createProject({ kind: 'app', name: 'invalid-app', parent: root, adapter: 'unknown' })
		).rejects.toThrow('Unsupported app adapter');
		await expect(
			createProject({ kind: 'lib', name: 'invalid-lib', parent: root, adapter: 'static' })
		).rejects.toThrow('only available for app projects');
		for (const name of ['invalid-app', 'invalid-lib']) {
			await expect(readFile(join(root, name, 'package.json'))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	}));

test.each(['app', 'lib'] as const)(
	'generated %s code and testing foundations obey their formatter and lint settings',
	async (kind) => {
		const files = projectFiles({ kind, name: 'format-proof' });
		await assertFoundationLint(files, kind);
		const options = JSON.parse(fileContents(files, '.prettierrc')) as Options;
		for (const file of files.filter((file) => /\.(js|ts|json|md)$/.test(file.path))) {
			expect(file.contents, file.path).toBe(
				await format(file.contents, { ...options, filepath: file.path })
			);
		}
	}
);

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

function expectAgentGuidance(files: Parameters<typeof fileContents>[0]): void {
	assertHarnessCliGuidance(files);
	expectRenameGuidance(files);
	for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md'])
		for (const command of ['map', 'search', 'show'])
			expect(fileContents(files, path)).toContain(`harness contracts ${command}`);
}
