import { afterEach, test, vi } from 'vitest';
import { ZodError } from 'zod';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { defaultVerifyConfig } from '../../src/core/verification-evidence/verifyTypes';
import { emptySide } from '../../src/workflows/development-tooling/loadRevisions';
import {
	renderAttachment,
	scopedContext,
	scopedImpact,
	scopedVerify,
	timer,
	verifyEnv
} from '../../src/workflows/verification-evidence/run-verify/scopedVerify';
import type { Base } from '../../src/workflows/verification-evidence/run-verify/scopedVerify.types';
import type { VerifyResult } from '../../src/workflows/verification-evidence/run-verify/runVerify.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const unitId = 'workflow.verification-evidence-run-verify-scoped-verify';
const entity = 'reports.component.evidence-grid';
const commit = '0123456789abcdef0123456789abcdef01234567';
const recordId = 'a'.repeat(64);

function context(root: string): Base {
	return {
		root,
		commit,
		tree: '89abcdef0123456789abcdef0123456789abcdef',
		baseCommit: null,
		requestedBase: null,
		base: emptySide(),
		head: emptySide(),
		config: defaultVerifyConfig
	};
}

afterEach(() => vi.restoreAllMocks());

test('Refuses scoped verification without a covering scenario', async () => {
	await withTempDir('scoped-verify-examples-', async (root) => {
		const options = { entity, testTimeout: '30000' };
		let outcome: { name: string; message: string };
		try {
			await scopedVerify(context(root), 'module', options, {
				CI: 'true',
				HARNESS_RESOURCE_PRIORITY: 'environment'
			});
			throw new Error('Expected scoped verification to reject an uncovered entity.');
		} catch (error) {
			if (!(error instanceof ExpectedCliError)) throw error;
			outcome = { name: error.name, message: error.message };
		}
		expect(outcome).toEqual({
			name: 'ExpectedCliError',
			message: `No scenario covers ${entity}; nothing can be verified for it.`
		});
		recordExampleCases(
			{
				unitId,
				symbol: 'scopedVerify',
				state: 'refuses-scoped-verification-without-a-covering-scenario',
				evidence: 'examples-cases',
				file: 'refuses-scoped-verification-without-a-covering-scenario.json'
			},
			[
				{
					name: 'A temporary source context has no scenario for the requested entity',
					input: {
						context: { root: '<temporary directory>', commit, headScenarios: [] },
						runtime: 'module',
						options,
						env: { CI: 'true', HARNESS_RESOURCE_PRIORITY: 'environment' }
					},
					error: outcome
				}
			]
		);
	});
});

test('Renders screenshot and evidence attachment outcomes', () => {
	const screenshot: NonNullable<VerifyResult['attachment']> = {
		status: 'attached', entity, record: recordId, states: ['reports.state.initial'], viewports: ['desktop']
	};
	const skipped: NonNullable<VerifyResult['attachment']> = {
		status: 'skipped', entity, record: recordId, states: [], viewports: []
	};
	const unchanged = { ...screenshot, status: 'unchanged' as const, viewports: [] };
	const cases: Parameters<typeof recordExampleCases>[1] = [
		{ name: 'No attachment is available', input: null, output: renderAttachment(undefined) },
		{ name: 'Skipped evidence has no screenshot slots', input: skipped, output: renderAttachment(skipped) },
		{ name: 'Attached screenshot lists its state and viewport', input: screenshot, output: renderAttachment(screenshot) },
		{ name: 'Reused evidence reports its unchanged record', input: unchanged, output: renderAttachment(unchanged) }
	];
	expect(cases.map((item) => item.output)).toEqual([
		[],
		[`No evidence attached for ${entity}: failed or incomplete run.`],
		[`Screenshots attached for ${entity}: states reports.state.initial; viewports desktop; record ${recordId}.`],
		[`Evidence unchanged for ${entity}: states reports.state.initial; record ${recordId}.`]
	]);
	recordExampleCases(
		{
			unitId,
			symbol: 'renderAttachment',
			state: 'renders-screenshot-and-evidence-attachment-outcomes',
			evidence: 'examples-cases',
			file: 'renders-screenshot-and-evidence-attachment-outcomes.json'
		},
		cases
	);
});

test('Uses the head revision as the scoped base', () => {
	const source = context('/workspace/project');
	const result = scopedContext(source);
	expect(result).not.toBe(source);
	expect(result.base).toBe(source.head);
	expect(result.head).toBe(source.head);
	const input = { root: '<repository>', commit, baseRevision: source.base.revision, headRevision: source.head.revision };
	recordExampleCases(
		{
			unitId,
			symbol: 'scopedContext',
			state: 'uses-the-head-revision-as-the-scoped-base',
			evidence: 'examples-cases',
			file: 'uses-the-head-revision-as-the-scoped-base.json'
		},
		[
			{
				name: 'A copied context reuses its head side as base and retains the head',
				input,
				output: { baseRevision: result.base.revision, headRevision: result.head.revision }
			}
		]
	);
});

test('Builds an empty impact report for the scoped revision', () => {
	const result = scopedImpact(commit, 'module');
	expect(result).toEqual({
		base: 'none', head: commit, runtime: 'module', expanded: false, changed: [],
		units: { direct: [], indirect: [], added: [], removed: [] },
		tests: { selected: [], excluded: [], removed: [] },
		scenarios: { affected: [], unaffected: [] }, uncertain: []
	});
	recordExampleCases(
		{
			unitId,
			symbol: 'scopedImpact',
			state: 'builds-an-empty-impact-report-for-the-scoped-revision',
			evidence: 'examples-cases',
			file: 'builds-an-empty-impact-report-for-the-scoped-revision.json'
		},
		[{ name: 'A module scoped run starts with no computed impact', input: { head: commit, runtime: 'module' }, output: result }]
	);
});

test('Writes scoped timings and suppresses unscoped output', () => {
	const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
	timer(entity)('snapshot started');
	const emitted = write.mock.calls.map(([chunk]) => String(chunk));
	expect(emitted).toHaveLength(1);
	expect(emitted[0]).toMatch(/^\[verify reports\.component\.evidence-grid\] snapshot started \+\d+ms\n$/);
	write.mockClear();
	timer(undefined)('unscoped step');
	timer('')('empty entity step');
	const suppressed = write.mock.calls.length;
	expect(suppressed).toBe(0);
	recordExampleCases(
		{
			unitId,
			symbol: 'timer',
			state: 'writes-scoped-timings-and-suppresses-unscoped-output',
			evidence: 'examples-cases',
			file: 'writes-scoped-timings-and-suppresses-unscoped-output.json'
		},
		[
			{ name: 'A truthy entity prefixes its timing message', input: { entity, step: 'snapshot started' }, output: emitted[0] },
			{ name: 'An omitted entity emits no timing message', input: { entity: null, step: 'unscoped step' }, output: { writes: suppressed } },
			{ name: 'An empty entity emits no timing message', input: { entity: '', step: 'empty entity step' }, output: { writes: suppressed } }
		]
	);
});

test('Sets verification priority and entity options', () => {
	const options = { priority: 'agent-test', entity };
	const environment = verifyEnv(options);
	const selected = {
		HARNESS_RESOURCE_PRIORITY: environment.HARNESS_RESOURCE_PRIORITY,
		HARNESS_VERIFY_ENTITY: environment.HARNESS_VERIFY_ENTITY
	};
	let invalid: { name: string; paths: string[] };
	try {
		verifyEnv({ priority: 'emergency' });
		throw new Error('Expected an unsupported resource priority to be rejected.');
	} catch (error) {
		if (!(error instanceof ZodError)) throw error;
		invalid = { name: error.name, paths: error.issues.map((issue) => issue.path.join('.')) };
	}
	expect(selected).toEqual({ HARNESS_RESOURCE_PRIORITY: 'agent-test', HARNESS_VERIFY_ENTITY: entity });
	expect(invalid).toEqual({ name: 'ZodError', paths: [''] });
	recordExampleCases(
		{
			unitId,
			symbol: 'verifyEnv',
			state: 'sets-verification-priority-and-entity-options',
			evidence: 'examples-cases',
			file: 'sets-verification-priority-and-entity-options.json'
		},
		[
			{ name: 'Explicit options select the test priority and entity', input: options, output: selected },
			{ name: 'An unsupported priority is rejected', input: { priority: 'emergency' }, error: invalid }
		]
	);
});
