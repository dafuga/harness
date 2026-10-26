import { expect } from '../../verificationExpect';
import type { projectFiles } from '../../../src/templates/project';

export function expectGeneratedGuidance(files: ReturnType<typeof projectFiles>): void {
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
		expect(text, path).toContain(
			'Layouts use the page form, with a labelled Child content placeholder in the real child slot.'
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
		expect(text, path).toContain(
			'Keep compiler, lint and audit checks before browser screenshot gates'
		);
		expect(text, path).toContain('fails explicitly');
		expect(text, path).not.toContain('Keep exhaustive boundary cases in tests');
	}
}

export function expectCatalogGuidance(files: ReturnType<typeof projectFiles>): void {
	for (const path of ['AGENTS.md', '.codex/skills/harness/SKILL.md']) {
		expect(fileContents(files, path)).toContain('Callable usage examples');
		expect(fileContents(files, path)).toContain('General text helpers belong in Strings');
		expect(fileContents(files, path)).toContain('reusable visual frames with a child-content slot');
		expect(fileContents(files, path)).toContain('Child content');
		expect(fileContents(files, path)).toContain('Full-frame previews own their content boundaries');
		expect(fileContents(files, path), 'Behavior-focused example guidance').toContain(
			'one representative example per distinct behavior'
		);
		expect(fileContents(files, path)).toContain('descriptive behavior titles');
		expect(fileContents(files, path)).toContain('src/helpers/<responsibility>/<camelName>.ts');
		expect(fileContents(files, path)).toContain('selected callable implementation');
	}
}

function fileContents(files: ReturnType<typeof projectFiles>, path: string): string {
	return files.find((file) => file.path === path)?.contents ?? '';
}

/** Static admission precedes any browser baseline decision in the generated normal check. */
export function expectStaticCheckOrder(check: string): void {
	expect(check.split(' && ').slice(0, 4), 'Static gates precede screenshot admission').toEqual([
		'bun run format:check',
		'bun run typecheck',
		'bun run lint',
		'bun run audit'
	]);
}

/** Each standalone app route gets SvelteKit virtual-module declarations without an API import. */
export function expectAppTypeReference(files: ReturnType<typeof projectFiles>): void {
	expect(fileContents(files, 'src/app.d.ts')).toContain('/// <reference types="@sveltejs/kit" />');
}
