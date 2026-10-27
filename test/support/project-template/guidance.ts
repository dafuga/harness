import { expect } from '../../verificationExpect';
import type { projectFiles } from '../../../src/templates/project';
import { appTestFiles } from '../../../src/templates/projects-sessions/projectTests';
import { measureWorkload } from '../measureWorkload';
import type { ComponentManifest } from '../../../src/core/unitTypes';
import type { UnitDocumentation } from '../../../src/utils/unit-documentation/unitDocumentation';
import { TestCaseValidator } from '../../../src/validators/verification-evidence/TestCaseValidator';
import { hydrateUnitDocumentation } from '../../../src/services/revision-detail-service/unitDocumentation';
import { usageExamples } from '../../../packages/reports/src/components/usage-examples/usageExamples';
import { loadUnits } from '../../../src/workflows/development-tooling/load-units/loadUnits';
import { registryErrors } from '../../../src/cli/program/manageUnits';
import { TestDiscoveryService } from '../../../src/services/verification-evidence/TestDiscoveryService';
import { TestContractService } from '../../../src/services/verification-evidence/TestContractService';
import { ScenarioManifestValidator } from '../../../src/validators/verification-evidence/ScenarioManifestValidator';
import { memoryTree } from '../memoryTree';

/** One generated library case and its rendered comment use the same registered Example. */
export async function expectGeneratedLibraryExample(files: ReturnType<typeof projectFiles>) {
	expect(files.map((file) => file.path)).toContain('specification/units/entry.index.json');
	const unit = JSON.parse(
		fileContents(files, 'specification/units/entry.index.json')
	) as ComponentManifest;
	expect(new TestCaseValidator().validate(unit, unit.testing).errors).toEqual([]);
	expect(unit.testing?.cases).toHaveLength(1);
	const documented = {
		id: unit.id,
		testing: unit.testing,
		documentation: undefined as UnitDocumentation | undefined
	};
	await hydrateUnitDocumentation(
		{
			read: async () => {
				throw new Error('No separate document');
			}
		},
		[documented]
	);
	expect(usageExamples(documented.documentation!.examples)).toEqual([
		'helloHarness()\n// => "hello from Harness"'
	]);
	const exampleTest = fileContents(files, 'test/index.test.ts');
	expect(exampleTest).toContain("test('helloHarness: returns a greeting'");
	expect(exampleTest).toContain('unit.testing.examples[0].expected.value');
	expect(exampleTest).not.toContain('hello from Harness');
	const tree = memoryTree(Object.fromEntries(files.map(({ path, contents }) => [path, contents])));
	const registry = await loadUnits('/generated-library', tree);
	expect(registryErrors(registry), 'The generated library registry must be canonical').toEqual([]);
}

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
			'passed, failed, skipped and retried cases in the existing generator cases'
		);
		expect(text, path).toContain('exercise the real runner on the designated test host');
		expect(text, path).toContain(
			'Keep one Playwright reporter declaration with both Harness and JSON reporters'
		);
		expect(text, path).toContain(
			'the declared build is stamped and the test owns its preview server'
		);
		expect(text, path).toContain('Check the generated build identity before browser capture');
		expect(text, path).toContain(
			'distinct declared case bindings sharing a state, viewport and evidence slot'
		);
		expect(text, path).toContain('plus wrong and duplicate bindings');
		expect(text, path).toContain('retries with differing outcomes');
		expect(text, path).toContain(
			'Preserve the unit, case, tested revision, attempt, original hash and outcome'
		);
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

/** The initial page has the same three declared devices as generated pages and layouts. */
export async function expectInitialPageViewports(files: ReturnType<typeof projectFiles>) {
	const direct = await measureWorkload('template.project-tests', 'initial-page-viewport-plan', () =>
		appTestFiles()
	);
	expect(fileContents(files, 'playwright.config.ts')).toContain("updateSnapshots: 'none'");
	const source = fileContents(files, 'tests/e2e/app.spec.ts');
	expect(source).toBe(fileContents(direct, 'tests/e2e/app.spec.ts'));
	for (const row of [
		"{ id: 'desktop', size: { width: 1440, height: 900 } }",
		"{ id: 'tablet', size: { width: 920, height: 800 } }",
		"{ id: 'mobile', size: { width: 390, height: 844 } }"
	])
		expect(source, 'Every initial-page viewport is explicitly declared').toContain(row);
	const found = new TestDiscoveryService().scan(source, 'tests/e2e/app.spec.ts');
	expect(
		found.map(({ title, dynamic }) => ({ title, dynamic })),
		'Generated initial page case identities must be statically discoverable'
	).toEqual(
		['desktop', 'tablet', 'mobile'].map((viewport) => ({
			title: `${viewport} viewport > app page initial state`,
			dynamic: false
		}))
	);
	expect(source).toContain('test.use({ viewport: viewport.size })');
	expect(source).toContain("test('app page initial state'");
	expect(source).toContain(
		"matchScreenshot(page, 'initial-' + viewport.id + '.png', { fullPage: true })"
	);
	const unit = JSON.parse(fileContents(files, 'specification/units/page.root.json'));
	const scenario = JSON.parse(fileContents(files, 'specification/scenarios/initial-page.json'));
	expect(new ScenarioManifestValidator().validate(scenario, 'initial-page.json').errors).toEqual(
		[]
	);
	expect(
		new TestContractService().validate({
			units: [unit],
			scenarios: [scenario],
			files: new Set(['tests/e2e/app.spec.ts']),
			tests: found,
			required: true
		})
	).toEqual([]);
	expect(
		unit.testing.cases.map((item: { expected: { file: string } }) => item.expected.file)
	).toEqual(
		['desktop', 'tablet', 'mobile'].map(
			(viewport) => `.cache/harness/visual-baselines/app.spec.ts/initial-${viewport}.png`
		)
	);
	expect(fileContents(files, 'playwright.config.ts')).toContain(
		"snapshotPathTemplate: '.cache/harness/visual-baselines/{testFilePath}/{arg}{ext}'"
	);
	expect(JSON.parse(fileContents(files, 'harness.units.json')).testing).toBe(1);
}
