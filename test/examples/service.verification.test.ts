import { fileChange, recordState } from './service.verification.fixture';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import type { ChangedFile } from '../../src/core/development-tooling/impactTypes';
import type { ScenarioManifest } from '../../src/core/development-tooling/unitTypes';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import type { ScenarioResult } from '../../src/core/verification-evidence/verificationTypes';
import { defaultVerifyConfig } from '../../src/core/verification-evidence/verifyTypes';
import type { Gathered } from '../../src/utils/verification-evidence/gatherCaptures';
import type { PlannedCheck } from '../../src/utils/verification-evidence/verifyPlan';
import { recordIntact } from '../../src/utils/verification-evidence/sealRecord';
import { emptySide, openRange } from '../../src/workflows/development-tooling/loadRevisions';
import type { Executed } from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService.types';
import { VerificationService } from '../../src/workflows/verification-evidence/run-verify/verification-service/VerificationService';
import type { VerifyContext } from '../../src/workflows/verification-evidence/run-verify/verification-service/VerificationService.types';
import { pendingVideoScenarioIds } from '../../src/workflows/verification-evidence/run-verify/verification-service/pendingVideoSelection';
import { pendingVideoSelection } from '../../src/workflows/verification-evidence/run-verify/verification-service/pendingVideoSelection';
import { verificationScenarioCoverage } from '../../src/workflows/verification-evidence/run-verify/verification-service/verificationScenarioCoverage';

import type { TemporaryRepo } from '../support/temporary.types';
import { withTempDir, withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

// Made-up revisions and paths: no state reads a repository it did not build itself.
const commit = '9c4e7a1f2b68d03e5a7c9f14d2b8e60a3f5c1d78';
const tree = 'e2f81b6c0d94a7135f0e8b2d6c9a41f7e3b05d28';
const previous = '5d07b3a9e16c48f20a7d9e3b15c6f08d2a4e91b7';
const docs = 'docs/verification.md';
const selectedFile = 'test/utils/plan-data.test.ts';
const gridUnit = 'reports.evidence-grid:evidence-grid-unit';
const gridBrowser = 'reports.evidence-grid:evidence-grid-browser';
const cardsUnit = 'reports.cards:cards';
const now = '2026-11-16T09:00:00.000Z';
const defaultStates = [{ id: 'default', title: 'Default state', coverage: 'required' }];
const noReasons = async () => ({ required: [], entries: [], overlong: [], failures: [] });
const pinned = { baseCommit: null, requestedBase: null };
const settings = { config: defaultVerifyConfig, env: {}, explained: noReasons };
const addedFiles = [fileChange('README.md', 'added'), fileChange(docs, 'added')];
const evidenceGrid = scenarioOf('reports.evidence-grid', [
	testOf('evidence-grid-unit', 'unit', 'src/reports/evidence-grid/EvidenceGrid.test.ts'),
	testOf('evidence-grid-browser', 'e2e', 'tests/e2e/evidence-grid.spec.ts')
]);
const legend = scenarioOf('reports.legend', [testOf('legend', 'unit', 'src/legend.test.ts')]);
const cards = scenarioOf('reports.cards', [testOf('cards', 'unit', 'src/cards.test.ts')]);
const exported = ['bulk-import', 'empty-library'];
const exportStates = [
	{ id: 'bulk-import', title: 'Bulk import', coverage: 'required' },
	{ id: 'empty-library', title: 'Empty library', coverage: 'required' },
	{ id: 'offline', title: 'Offline', coverage: 'missing', reason: 'Not run in CI' }
];
const output = { id: 'output', kind: 'output', states: exported, viewports: [], required: true };
const exportTests = [testOf('exports', 'unit', 'src/exports.test.ts')];
const exportsScenario = scenarioOf('reports.exports', exportTests, exportStates, [output]);

test('run saves a sealed record for a commit with nothing proven', async () => {
	await withTempRepo(async (repo) => {
		const { root, git } = repo;
		mkdirSync(join(root, 'docs'));
		writeFileSync(join(root, 'README.md'), 'Fixture\n');
		writeFileSync(join(root, docs), 'Verification notes\n');
		git('add', '-A');
		git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'Add fixture files');
		const revision = git('rev-parse', 'HEAD');
		const { record, directory } = await runCommit(repo, revision, addedFiles);
		expect(record.status).toBe('passed');
		expect(record.source).toMatchObject({ commit: revision, base: null });
		expect(new Set(Object.values(record.gates ?? {}))).toEqual(new Set(['passed']));
		expect(recordIntact(record)).toBe(true);
		expect(directory).toContain(join('.cache', 'harness', 'verifications', revision));
		const saved: unknown = JSON.parse(readFileSync(join(directory, 'record.json'), 'utf8'));
		expect(saved).toEqual(record);
		const summary = { status: record.status, source: record.source, gates: record.gates };
		recordState('VerificationService.run', [['fixture commit', { revision }, summary]]);
	});
}, 20000);

test('plan lists selected test files first, then scenario checks', async () => {
	await withTempDir('service-verification-examples-', async (root) => {
		const context = { ...contextOf([evidenceGrid], [selectedFile]), root };
		const planned = new VerificationService(context).plan();
		expect(idsOf(planned)).toEqual([selectedFile, gridUnit, gridBrowser]);
		expect(planned[0].command).toBe(`bun x vitest run ${selectedFile}`);
		recordState('VerificationService.plan', [
			['selected file and scenario checks', { selectedFile }, planned]
		]);
	});
});

test('pending video ids stay empty without video evidence', async () => {
	await withTempRepo(async ({ root }) => {
		const scenarios = [evidenceGrid, legend];
		const pending = await pendingVideoScenarioIds(root, scenarios);
		expect(pending).toBeInstanceOf(Set);
		expect([...pending]).toEqual([]);
		const names = idsOf(scenarios);
		recordState('pendingVideoScenarioIds', [['no video evidence', names, [...pending]]]);
	});
});

test('pending video scenarios rerun while others are inherited', () => {
	const context = contextOf([legend, cards, evidenceGrid], [selectedFile]);
	const runs = [tested(legend.id), tested(cards.id)];
	const flagged = new Set([cards.id]);
	const pending = pendingVideoSelection(context, runs, flagged);
	const inherited = pendingVideoSelection(context, runs);
	const scoped = pendingVideoSelection({ ...context, entity: evidenceGrid.id }, runs, flagged);
	expect(idsOf(pending.referenced)).toEqual([legend.id]);
	expect(pending.referenced[0].testedRevision).toBe(previous);
	expect(idsOf(pending.plan)).toEqual([selectedFile, cardsUnit, gridUnit, gridBrowser]);
	expect(idsOf(inherited.referenced)).toEqual([legend.id, cards.id]);
	expect(idsOf(scoped.referenced)).toEqual([]);
	expect(idsOf(scoped.plan)).toEqual([gridUnit, gridBrowser]);
	recordState('pendingVideoSelection', [
		['cards is flagged, so it reruns', { pending: [cards.id] }, selectionOf(pending)],
		['nothing flagged, so cards is inherited', { pending: [] }, selectionOf(inherited)],
		['entity scope inherits nothing', { entity: evidenceGrid.id }, selectionOf(scoped)]
	]);
});

test('coverage names missing captures and declared missing states', () => {
	const context = contextOf([exportsScenario]);
	const [check] = new VerificationService(context).plan();
	const judge = (ok: boolean, gathered: Gathered[]) =>
		verificationScenarioCoverage(context, exportsScenario, executedOf(check, ok, gathered));
	const complete = judge(true, [gatheredOf('bulk-import'), gatheredOf('empty-library')]);
	const incomplete = judge(false, [gatheredOf('bulk-import')]);
	const declared = 'reports.exports: state offline is declared missing: Not run in CI';
	const missing = 'reports.exports: missing output for state empty-library';
	expect(complete.coverage.failures).toEqual([declared]);
	expect(statusesOf(complete)).toEqual([['passed'], ['passed'], []]);
	expect(incomplete.coverage.failures).toEqual([declared, missing]);
	expect(statusesOf(incomplete)).toEqual([['failed'], [], []]);
	recordState('verificationScenarioCoverage', [
		['both required states captured by a passing check', { ok: true }, complete.coverage],
		['a failing check that left empty-library uncaptured', { ok: false }, incomplete.coverage]
	]);
});

const idsOf = (items: { id: string }[]) => items.map((item) => item.id);
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

function testOf(id: string, kind: 'unit' | 'e2e', target: string) {
	return { id, kind, runner: kind === 'unit' ? 'vitest' : 'playwright', target };
}

/** A headless scenario built through the scenario schema, so every fixture is a valid manifest. */
function scenarioOf(id: string, tests: unknown[], states = defaultStates, proofs: unknown[] = []) {
	const base = { schemaVersion: 1, title: id, kind: 'headless', units: [id], viewports: [] };
	return scenarioManifestSchema.parse({ ...base, id, states, tests, evidence: proofs });
}

function impactOf(from: string, to: string, changed: ChangedFile[], picked: string[]) {
	const common = { base: from, head: to, runtime: 'module' as const, expanded: false, changed };
	const units = { direct: [], indirect: [], added: [], removed: [] };
	const tests = { selected: picked, excluded: [], removed: [] };
	return { ...common, units, tests, scenarios: { affected: [], unaffected: [] }, uncertain: [] };
}

/** The context of a commit whose base nothing proves: the empty base side, with no record. */
function contextOf(scenarios: ScenarioManifest[], selected: string[] = []): VerifyContext {
	const head = { ...emptySide(), revision: commit, scenarios };
	const impact = impactOf('none', commit, [], selected);
	return { commit, tree, ...pinned, ...settings, root: 'example', base: emptySide(), head, impact };
}

/** Verifies one revision the way the verify command builds its context when nothing is proven. */
async function runCommit(repo: TemporaryRepo, revision: string, changed: ChangedFile[]) {
	const sides = await openRange({ root: repo.root, base: 'none', head: revision });
	const at = { commit: revision, tree: repo.git('rev-parse', `${revision}^{tree}`) };
	const impact = impactOf('none', revision, changed, []);
	const context: VerifyContext = { ...at, ...pinned, ...settings, ...sides, impact };
	return new VerificationService(context).run();
}

function tested(id: string): ScenarioResult {
	return { id, status: 'passed', testedRevision: previous, states: [] };
}

function selectionOf(selection: ReturnType<typeof pendingVideoSelection>) {
	const { referenced, rerun, plan } = selection;
	return { referenced: idsOf(referenced), rerun: idsOf(rerun), plan: idsOf(plan) };
}

function gatheredOf(state: string): Gathered {
	const file = `exports-output-${state}.txt`;
	const meta = { path: file, sha256: digest(file), bytes: 24, capturedAt: now };
	const common = { evidence: 'output', kind: 'output' as const, state, mediaType: 'text/plain' };
	return { line: { ...common, file }, capture: { ...common, ...meta, status: 'passed' } };
}

function executedOf(check: PlannedCheck, ok: boolean, gathered: Gathered[]): Executed {
	const { id, kind, runner, target } = check;
	const log = { path: 'logs/exports-unit.log', sha256: digest('log'), bytes: 3 };
	const status: 'passed' | 'failed' = ok ? 'passed' : 'failed';
	const entry = { id, kind, runner, target, status, durationMs: 1200, log };
	const outcome = { check, passed: ok, entry, gathered, failures: ok ? [] : ['exports failed'] };
	const none: never[] = [];
	const quiet = { mutated: none, added: none, setupFailures: none };
	const built = { tools: none, artifacts: {}, buildFailures: none };
	return { outcomes: [outcome], ...quiet, ...built };
}

function statusesOf(result: ReturnType<typeof verificationScenarioCoverage>) {
	return result.coverage.states.map((state) => state.captures.map((capture) => capture.status));
}
