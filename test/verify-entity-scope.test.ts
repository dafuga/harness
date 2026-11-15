import { afterAll, beforeAll, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { baselineRepo, cloneRepo, type VerifyRepo } from './support/verifyRepo';
import { evidenceRef, noteLines, lfsObjectPath } from './support/historyRepo';
import { expect } from './verificationExpect';
import { measureWorkload } from './support/measureWorkload';
import {
	scopedCheck,
	scopedScenarios,
	scopeFailure
} from '../src/workflows/verification-evidence/run-verify/verification-service/entityScope';
import { scopedContext } from '../src/workflows/verification-evidence/run-verify/scopedVerify';
import type { ScenarioManifest } from '../src/core/development-tooling/unitTypes';
import { twoOwnerVideo } from './support/videoEnrollmentFixture';
import type { PlannedCheck } from '../src/utils/verification-evidence/verifyPlan';
const badge = 'reports.component.status-badge';
const catalog = {
	id: 'catalog',
	units: [badge, 'reports.component.modal'],
	states: [
		{ id: 'badge', units: [badge] },
		{ id: 'badge-failed', units: [badge] },
		{ id: 'modal', units: ['reports.component.modal'] }
	],
	viewports: [{ id: 'desktop' }, { id: 'mobile' }],
	evidence: [{ id: 'screens', kind: 'screenshot', states: ['badge', 'badge-failed', 'modal'] }],
	tests: [],
	video: twoOwnerVideo(badge, 'badge', 'reports.component.modal', 'modal')
} as unknown as ScenarioManifest;
const other = { ...catalog, id: 'other', units: ['x'], states: [], evidence: [] };
test('a scoped run keeps only the scenarios and states that show the entity', () => {
	const [scoped, ...rest] = scopedScenarios([catalog, other], badge);
	expect(rest).toEqual([]);
	expect(scoped.units).toEqual([badge]);
	expect(scoped.states.map((state) => state.id)).toEqual(['badge', 'badge-failed']);
	expect(scoped.evidence?.[0].states).toEqual(['badge', 'badge-failed']);
	expect(scoped.viewports).toHaveLength(2);
	expect(scoped.video?.clips.map((clip) => clip.id)).toEqual(['use-feature']);
	expect(scoped.video?.graphs.map((graph) => graph.id)).toEqual(['feature']);
	expect(scoped.video?.playlists).toEqual([{ id: 'all', clips: ['use-feature'] }]);
	const implicit = {
		...catalog,
		states: catalog.states.map(({ id }) => ({ id }))
	} as ScenarioManifest;
	const [inherited] = scopedScenarios([implicit], badge);
	expect(inherited.states.map(({ id }) => id)).toEqual(['badge', 'badge-failed', 'modal']);
	// A shared scenario, as explorer-shell is for a verdict: only its unnamed states show it.
	const mixed = {
		...catalog,
		units: [...catalog.units, 'reports.component.verdict'],
		states: [{ id: 'bar' }, ...catalog.states]
	} as ScenarioManifest;
	const [shared] = scopedScenarios([mixed], 'reports.component.verdict');
	expect(shared.states.map(({ id }) => id)).toEqual(['bar']);
	expect(shared.evidence?.[0].states).toEqual([]);
});
test('an entity no scenario covers is refused', () => {
	expect(() => scopedScenarios([catalog], 'reports.component.none')).toThrow('No scenario covers');
});
test('a scoped Playwright check greps the tests named after the entity', () =>
	measureWorkload(
		'workflow.verification-evidence-run-verify-verification-service-entity-scope',
		'scope-catalog-and-page-checks',
		() => {
			const check = {
				scenario: 'component-catalog-previews',
				runner: 'command',
				command: 'bun x playwright test explorer-shell-component-catalog.spec.ts'
			} as PlannedCheck;
			const grep = new RegExp(scopedCheck(check, badge).command.split("--grep '")[1].slice(0, -1));
			expect(grep.test('a.spec.ts > reports.component.status-badge at desktop')).toBe(true);
			expect(grep.test('reports.component.status-badge:failed at mobile')).toBe(true);
			expect(grep.test('reports.component.status-badge-x at desktop')).toBe(false);
			expect(grep.test('reports.component.modal at desktop')).toBe(false);
			const vitest = { runner: 'vitest', command: 'vitest run a.test.ts' } as PlannedCheck;
			expect(scopedCheck(vitest, badge)).toBe(vitest);
			const page = {
				scenario: 'explorer-platforms',
				runner: 'command',
				command: 'bun x playwright test test/entity-preview-platforms.spec.ts'
			} as PlannedCheck;
			expect(scopedCheck(page, badge), 'Page scenarios keep their own test names').toBe(page);
		}
	));
test('a scoped Playwright check preserves a scenario selector', () => {
	const check = {
		scenario: 'component-catalog-previews',
		runner: 'command',
		command: "bun x playwright test preview.spec.ts --grep 'APIs catalog'"
	} as PlannedCheck;
	expect(scopedCheck(check, badge)).toBe(check);
});
test('a scoped record states it is partial', () => {
	expect(scopeFailure(badge)).toContain('partial and never a full pass');
});
test('a scoped run does not reopen repository-wide gates from an empty base', () => {
	const base = { name: 'empty' };
	const head = { name: 'head' };
	const context = scopedContext({ base, head } as never);
	expect(context.base).toBe(head);
});
let baseline: VerifyRepo;
beforeAll(async () => {
	baseline = await baselineRepo(async (repo) => {
		const path = 'specification/scenarios/titles-page.json';
		const scenario = await repo.json<{ states: { id: string }[] }>(path);
		const states = scenario.states.map((state) => ({ ...state, units: ['page.titles'] }));
		await repo.write(path, JSON.stringify({ ...scenario, states }));
	});
}, 120_000);
afterAll(() => baseline?.dispose());
const entityFlags = ['--priority', 'agent-test', '--entity'];
async function entityRun(
	repo: VerifyRepo,
	env: Record<string, string> = {},
	entity = 'page.titles'
) {
	const result = await repo.run(['verify', 'run', ...entityFlags, entity, '--json'], env);
	return { ...result, ...JSON.parse(result.stdout) };
}
test(
	'entity verification attaches every state and viewport with its record link',
	async () =>
		measureWorkload('workflow.run-verify', 'entity-screenshot-attachment', async () => {
			const repo = await cloneRepo(baseline);
			try {
				// Dirty/uncommitted tests are excluded: only the committed snapshot supplies proof.
				await repo.write('scripts/fixture.mjs', 'process.exit(1);');
				const result = await entityRun(repo);
				expect(result.attachment).toMatchObject({
					status: 'attached',
					entity: 'page.titles',
					record: result.record.id,
					states: ['empty', 'filled'],
					viewports: ['desktop', 'mobile', 'tablet']
				});
				expect(result.exitCode).toBe(0);
				expect(result.record.status).toBe('failed'); // Focused proof never verifies the whole tree.
				const notes = (await noteLines(repo)).filter((line) => line.kind === 'verification');
				expect(notes).toHaveLength(1);
				expect(notes[0].record).toBe(result.record.id);
				const path = `records/${result.record.source.commit}/${result.record.id}`;
				const stored = JSON.parse(await repo.git(['show', `${evidenceRef}:${path}/record.json`]));
				expect(stored).toEqual(result.record);
				const captures = stored.scenarios[0].states.flatMap(
					(state: { captures: object[] }) => state.captures
				);
				expect(captures).toHaveLength(6);
				for (const state of stored.scenarios[0].states)
					for (const capture of state.captures) {
						expect(await readFile(lfsObjectPath(repo.root, capture.sha256))).toEqual(
							await readFile(join(result.directory, capture.path))
						);
					}
				const text = await repo.run(['verify', 'run', ...entityFlags, 'page.titles']);
				expect(text.stdout).toContain('page.titles');
				expect(text.stdout).toContain('desktop, mobile, tablet');
				expect(text.stdout).toContain(result.record.id);
			} finally {
				await repo.dispose();
			}
		}),
	120_000
);
test('repeating entity verification keeps one attached record for identical proof', async () => {
	const repo = await cloneRepo(baseline);
	try {
		const first = await entityRun(repo);
		const evidence = await repo.git(['rev-parse', evidenceRef]);
		const notes = await noteLines(repo);
		const again = await entityRun(repo);
		expect(again.attachment).toMatchObject({ status: 'unchanged', record: first.record.id });
		expect(await repo.git(['rev-parse', evidenceRef])).toBe(evidence);
		expect(await noteLines(repo)).toEqual(notes);
	} finally {
		await repo.dispose();
	}
}, 120_000);
test("a headless entity's complete evidence is attached with its record", async () => {
	const repo = await cloneRepo(baseline);
	try {
		const result = await entityRun(repo, {}, 'service.clock');
		expect(result.exitCode).toBe(0);
		expect(result.attachment).toEqual({
			status: 'attached',
			entity: 'service.clock',
			record: result.record.id,
			states: ['default'],
			viewports: []
		});
		const notes = (await noteLines(repo)).filter((line) => line.kind === 'verification');
		expect(notes.map((note) => note.record)).toEqual([result.record.id]);
	} finally {
		await repo.dispose();
	}
}, 120_000);
test.each([
	[{ FIXTURE_FAIL: '1' }, 'test page failed'],
	[{ FIXTURE_SKIP: 'filled-mobile' }, 'missing screenshot for state filled at viewport mobile'],
	[
		{ FIXTURE_SKIP: 'empty-desktop,empty-tablet,empty-mobile' },
		'missing screenshot for state empty'
	]
])(
	'an incomplete or failed entity run attaches nothing: %j',
	async (env, failure) => {
		const repo = await cloneRepo(baseline);
		try {
			const result = await entityRun(repo, env);
			expect(result.exitCode).toBe(1);
			expect(result.record.failures.join('\n')).toContain(failure);
			expect(result.attachment).toMatchObject({ status: 'skipped', entity: 'page.titles' });
			expect(result.stderr).toContain('No screenshots attached');
			await expect(repo.git(['rev-parse', '--verify', '--quiet', evidenceRef])).rejects.toThrow();
			expect(await repo.git(['notes', '--ref=harness', 'list'])).toBe('');
		} finally {
			await repo.dispose();
		}
	},
	120_000
);
