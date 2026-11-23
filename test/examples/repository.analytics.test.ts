import { PROJECT, STEP, EVALUATION } from './repository.analytics.fixture';
import type { Step } from './repository.analytics.test.types';
import { spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { InvalidRetentionCutoffError } from '../../src/repositories/reports-media/InvalidRetentionCutoffError';
import { UnsupportedAnalyticsSchemaVersionError } from '../../src/repositories/reports-media/UnsupportedAnalyticsSchemaVersionError';

const REPOSITORY_PATH = fileURLToPath(
	new URL('../../src/repositories/reports-media/AnalyticsRepository.ts', import.meta.url)
);
const CUTOFF = '2025-01-01T00:00:00.000Z';
const LOOP = {
	id: '3b9f6c2a-1d4e-4f8a-9b27-5c0e7d1a6f43',
	timestamp: '2026-11-14T09:30:12.345Z',
	project: PROJECT,
	kind: 'loop',
	action: 'created'
};

function dated(id: string, timestamp: string, extra: Step = {}): Step {
	return { id, timestamp, project: PROJECT, kind: 'loop', action: 'created', ...extra };
}

function meta(symbol: string, state: string) {
	return {
		unitId: 'repository.analytics',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function childScript(): string {
	return `const { AnalyticsRepository } = await import(${JSON.stringify(REPOSITORY_PATH)});
const { Database } = await import('bun:sqlite');
const steps = JSON.parse(process.argv[2]);
let repo;
function sql(step) {
  const db = new Database(step.home + "/analytics.sqlite");
  try { db.exec(step.sql); } finally { db.close(); }
}
async function run(step) {
  try {
    if (step.op === 'open') repo = await AnalyticsRepository.open(step.home);
    else if (step.op === 'construct') repo = new AnalyticsRepository(step.home, step.options);
    else if (step.op === 'record') repo.record(step.event);
    else if (step.op === 'recordImported') repo.recordImported(step.event);
    else if (step.op === 'events') return repo.events();
    else if (step.op === 'prune') return repo.prune(step.before, step.apply);
    else if (step.op === 'reconcile') await repo.reconcileHistorical(step.root, step.project);
    else if (step.op === 'close') repo.close();
    else if (step.op === 'sql') sql(step);
    return null;
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
}
const results = [];
for (const step of steps) results.push(await run(step));
process.stdout.write(JSON.stringify(results));`;
}

function runSteps(directory: string, steps: Step[]): unknown[] {
	const script = join(directory, 'steps.mjs');
	writeFileSync(script, childScript());
	const run = spawnSync('bun', [script, JSON.stringify(steps)], {
		encoding: 'utf8',
		timeout: 15_000
	});
	if (run.status !== 0)
		throw new Error(`bun step runner exited with ${run.status}: ${run.stderr.slice(-800)}`);
	return JSON.parse(run.stdout) as unknown[];
}

function errorOf(error: Error): { error: { name: string; message: string } } {
	return { error: { name: error.name, message: error.message } };
}

test('Records events once per id and lists them by timestamp', () =>
	withTempDir('analytics-record-', (directory) => {
		const duplicate = { ...LOOP, action: 'deleted' };
		const results = runSteps(directory, [
			{ op: 'open', home: join(directory, 'store') },
			{ op: 'record', event: STEP },
			{ op: 'record', event: LOOP },
			{ op: 'record', event: duplicate },
			{ op: 'events' }
		]);

		expect(results[4]).toEqual([LOOP, STEP]);
		recordExampleCases(
			meta('AnalyticsRepository.record', 'records-events-once-per-id-and-lists-them-by-timestamp'),
			[
				{ name: 'stores events ordered by timestamp', input: [STEP, LOOP], output: [LOOP, STEP] },
				{
					name: 'ignores a second event with an existing id',
					input: duplicate,
					output: [LOOP, STEP]
				}
			]
		);
	}));

test('Upserts imported events and keeps live rows live', () =>
	withTempDir('analytics-import-', (directory) => {
		const reEvaluated = { ...EVALUATION, action: 're-evaluated' };
		const importedStep = { ...STEP, historical: true };
		const results = runSteps(directory, [
			{ op: 'open', home: join(directory, 'store') },
			{ op: 'recordImported', event: EVALUATION },
			{ op: 'recordImported', event: STEP },
			{ op: 'recordImported', event: importedStep },
			{ op: 'recordImported', event: reEvaluated },
			{ op: 'events' }
		]);

		expect(results[5]).toEqual([reEvaluated, { ...STEP, historical: false }]);
		recordExampleCases(
			meta(
				'AnalyticsRepository.recordImported',
				'upserts-imported-events-and-keeps-live-rows-live'
			),
			[
				{
					name: 'live row imported as historical is stored as not historical',
					input: importedStep,
					output: { ...STEP, historical: false }
				},
				{
					name: 'historical row replaced by a re-evaluated import',
					input: reEvaluated,
					output: reEvaluated
				}
			]
		);
	}));

test('Deletes only historical rows when the project root moved', () =>
	withTempDir('analytics-reconcile-', (directory) => {
		const root = join(directory, 'harness-app-feature');
		mkdirSync(root);
		const canonical = realpathSync(root);
		const historical = dated('a1', '2026-11-10T08:00:00.000Z', {
			project: canonical,
			historical: true
		});
		const live = dated('a2', '2026-11-11T08:00:00.000Z', { project: canonical });
		const other = dated('a3', '2026-11-12T08:00:00.000Z', {
			project: '/workspace/projects/other',
			historical: true
		});
		const results = runSteps(directory, [
			{ op: 'open', home: join(directory, 'store') },
			{ op: 'record', event: historical },
			{ op: 'record', event: live },
			{ op: 'record', event: other },
			{ op: 'reconcile', root, project: canonical },
			{ op: 'events' },
			{ op: 'reconcile', root, project: PROJECT },
			{ op: 'events' }
		]);

		expect(results[5]).toEqual([historical, live, other]);
		expect(results[7]).toEqual([live, other]);
		recordExampleCases(
			meta(
				'AnalyticsRepository.reconcileHistorical',
				'deletes-only-historical-rows-when-the-project-root-moved'
			),
			[
				{
					name: 'same canonical path leaves rows untouched',
					input: { root: 'harness-app-feature', project: 'canonical root' },
					output: [historical, live, other]
				},
				{
					name: 'moved root deletes historical canonical rows',
					input: { root: 'harness-app-feature', project: PROJECT },
					output: [live, other]
				}
			]
		);
	}));

test('Previews retention by default and deletes when applied', () =>
	withTempDir('analytics-prune-', (directory) => {
		const results = runSteps(directory, [
			{ op: 'open', home: join(directory, 'store') },
			{ op: 'record', event: dated('o1', '2024-03-01T08:00:00.000Z') },
			{ op: 'record', event: dated('o2', '2024-06-15T08:00:00.000Z') },
			{ op: 'record', event: LOOP },
			{ op: 'prune', before: CUTOFF },
			{ op: 'prune', before: CUTOFF, apply: true },
			{ op: 'events' }
		]);

		expect(results[4]).toEqual({ before: CUTOFF, matching: 2, deleted: 0, dryRun: true });
		expect(results[5]).toEqual({ before: CUTOFF, matching: 2, deleted: 2, dryRun: false });
		expect(results[6]).toEqual([LOOP]);
		recordExampleCases(
			meta('AnalyticsRepository.prune', 'previews-retention-by-default-and-deletes-when-applied'),
			[
				{
					name: 'default call counts matching rows without deleting',
					input: { before: CUTOFF },
					output: results[4]
				},
				{
					name: 'apply true deletes the matching rows',
					input: { before: CUTOFF, apply: true },
					output: results[5]
				}
			]
		);
	}));

test('Rejects retention cutoffs that are not past UTC instants', () =>
	withTempDir('analytics-cutoff-', (directory) => {
		const cutoffs = [
			'2099-01-01T00:00:00.000Z',
			'2024-06-15T00:00:00',
			'2024-06-15T10:00:00.000+02:00',
			'not-a-date'
		];
		const results = runSteps(directory, [
			{ op: 'open', home: join(directory, 'store') },
			...cutoffs.map((before) => ({ op: 'prune', before }))
		]);

		const rejected = errorOf(new InvalidRetentionCutoffError());
		expect(results.slice(1)).toEqual(cutoffs.map(() => rejected));
		recordExampleCases(
			meta('AnalyticsRepository.prune', 'rejects-retention-cutoffs-that-are-not-past-utc-instants'),
			cutoffs.map((before) => ({
				name: `rejects cutoff ${before}`,
				input: { before },
				error: rejected.error
			}))
		);
	}));

test('Rejects a database with a newer schema version', () =>
	withTempDir('analytics-schema-', (directory) => {
		const home = join(directory, 'store');
		const results = runSteps(directory, [
			{ op: 'construct', home, options: {} },
			{ op: 'close' },
			{ op: 'sql', home, sql: 'PRAGMA user_version=2;' },
			{ op: 'construct', home },
			{ op: 'open', home }
		]);

		const unsupported = errorOf(new UnsupportedAnalyticsSchemaVersionError());
		expect(results.slice(3)).toEqual([unsupported, unsupported]);
		recordExampleCases(
			meta('AnalyticsRepository', 'rejects-a-database-with-a-newer-schema-version'),
			[
				{
					name: 'constructor rejects user_version 2',
					input: { userVersion: 2 },
					error: unsupported.error
				},
				{ name: 'open rejects user_version 2', input: { userVersion: 2 }, error: unsupported.error }
			]
		);
	}));
