import { PerformanceProfileService } from '../src/services/PerformanceProfileService';
import { afterAll, expect, test } from 'vitest';
import { projectFiles } from '../src/templates/project';
import { format, type Options } from 'prettier';

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
	expect(paths).toContain('harness.audit.json');
	expect(paths).toContain('.prettierrc');
	expect(paths).toContain('.prettierignore');
	expect(paths).toContain('scripts/harness-audit.ts');
	expect(paths).toContain('src/app.html');
	expect(paths).toContain('specification/README.md');
	expect(paths).toContain('.codex/skills/harness/SKILL.md');
	expect(fileContents(files, 'AGENTS.md')).toContain('Treat Harness as the operating contract');
	expect(fileContents(files, 'AGENTS.md')).toContain('bun run check');
	expect(fileContents(files, '.codex/skills/harness/SKILL.md')).toContain(
		'Use this skill whenever'
	);
	expect(fileContents(files, '.codex/skills/harness/SKILL.md')).toContain(
		'harness info scaffolds --json'
	);
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

function fileContents(files: ReturnType<typeof projectFiles>, path: string): string {
	return files.find((file) => file.path === path)?.contents ?? '';
}

function auditConfig(files: ReturnType<typeof projectFiles>): { limits: Record<string, number> } {
	return JSON.parse(fileContents(files, 'harness.audit.json')) as {
		limits: Record<string, number>;
	};
}

test('generated project guidance requires Harness completion audits and keeps planning read-only', () => {
	for (const files of [
		projectFiles({ kind: 'app', name: 'demo' }),
		projectFiles({ kind: 'lib', name: 'demo' })
	]) {
		for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
			const guidance = fileContents(files, path);
			expect(guidance).toContain('harness task check');
			expect(guidance).toContain('harness verify run --require-performance');
			expect(guidance).toContain('Planning tasks remain planning-only');
			expect(guidance).toContain('structural and evidence heuristics');
			expect(guidance).toContain('active visual component requires a preview');
			expect(guidance).toContain('A missing image or failed verdict blocks handoff');
			expect(guidance).toContain('state labels confined to scenario states');
			expect(guidance).toContain('required parent layout');
			expect(guidance).toContain('isolate app themes');
			expect(guidance).toContain('Reject caught fixture errors');
			expect(guidance).toContain('synthetic media inputs');
			expect(guidance).toContain('reject undeclared media');
		}
	}
});

afterAll(async () => {
	await new PerformanceProfileService().capture(
		{ unit: 'template.project-guidance', workload: 'generate-app-guidance', iterations: 100 },
		() => projectFiles({ kind: 'app', name: 'demo' })
	);
});
