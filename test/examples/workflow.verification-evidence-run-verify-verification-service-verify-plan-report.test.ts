import type {
	Source,
	PlanInput
} from './workflow.verification-evidence-run-verify-verification-service-verify-plan-report.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { verifyPlanReport } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlanReport';
import type { VerifyPlanReport } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlanReport.types';

const SERVICE = 'src/workflows/verification-evidence/run-verify/verification-service';
const UNIT = `${SERVICE}/verifyPlanReport.test.ts`;
const WORKFLOW = `${SERVICE}/verifyPlanWorkflow.test.ts`;
const TYPES = `${SERVICE}/verifyPlanWorkflow.types.test.ts`;
const ENTITY = 'workflow.verification-evidence-run-verify-verification-service-verify-plan-report';

const FULL_SOURCE: Source = {
	commit: '0123456789abcdef0123456789abcdef01234567',
	base: null,
	requestedBase: null,
	runtime: 'module',
	scope: 'full',
	baseResolution: 'empty-conservative',
	selectionNote:
		'No locally cached passing base was provable without restoring evidence. Planned from an empty base; a run may restore proof and select fewer checks.'
};

const ENTITY_SOURCE: Source = {
	commit: '89abcdef0123456789abcdef0123456789abcdef',
	base: null,
	requestedBase: null,
	runtime: 'module',
	scope: 'entity',
	entity: ENTITY,
	baseResolution: 'entity',
	selectionNote: 'Entity planning uses the same scoped scenario selection as verify run --entity.'
};

function vitestCheck(file: string, command: string, kind: 'unit' | 'integration' = 'unit') {
	return {
		id: file,
		name: file,
		kind,
		runner: 'vitest' as const,
		target: file,
		cwd: '.',
		command,
		timeoutMs: 600000
	};
}

const PLAN: PlanInput = [
	vitestCheck(UNIT, `bun x vitest run ${UNIT}`),
	vitestCheck(WORKFLOW, `bun x vitest run ${WORKFLOW}`),
	vitestCheck(
		TYPES,
		`bun x vitest run --config vitest.integration.config.ts ${TYPES}`,
		'integration'
	),
	{
		id: `${ENTITY}:browser-report`,
		scenario: ENTITY,
		name: 'browser-report',
		kind: 'e2e',
		runner: 'playwright',
		target: 'tests/e2e/verification-plan.spec.ts',
		cwd: '.',
		command: 'bun x playwright test --project=chromium',
		timeoutMs: 600000
	}
];

function summarise(report: VerifyPlanReport) {
	return {
		mode: report.mode,
		executedChecks: report.executedChecks,
		plannedChecks: report.plannedChecks,
		candidateGroups: report.candidateGroups,
		candidateChecks: report.candidateChecks,
		singletons: report.singletons,
		ineligible: report.ineligible,
		decisions: report.checks.map((check) => `${check.id}: ${check.decision}`),
		candidates: report.candidates.map((candidate) => ({
			id: candidate.id,
			commandTemplate: candidate.commandTemplate,
			checks: candidate.checks.map((check) => check.id)
		}))
	};
}

test('Groups matching vitest checks and marks the rest', () => {
	const report = verifyPlanReport(PLAN, FULL_SOURCE);

	expect(report.executedChecks).toBe(0);
	expect(report.candidateGroups).toBe(1);
	expect(report.candidates[0]?.commandTemplate).toBe('bun x vitest run {target}');
	expect(report.checks.map((check) => check.decision)).toEqual([
		'candidate',
		'candidate',
		'singleton',
		'ineligible'
	]);
	expect(report.checks[3]?.reason).toContain('Could not prove');

	recordExampleCases(
		{
			unitId: 'workflow.verification-evidence-run-verify-verification-service-verify-plan-report',
			symbol: 'verifyPlanReport',
			state: 'groups-matching-vitest-checks-and-marks-the-rest',
			evidence: 'examples-cases',
			file: 'groups-matching-vitest-checks-and-marks-the-rest.json'
		},
		[
			{
				name: 'four planned checks: two vitest candidates, one singleton, one playwright ineligible',
				input: { plannedChecks: PLAN.map((check) => check.id), source: FULL_SOURCE },
				output: summarise(report)
			}
		]
	);
});

test('Reports entity-scoped planning without executing checks', () => {
	const plan = PLAN.slice(0, 1);
	const report = verifyPlanReport(plan, ENTITY_SOURCE);

	expect(report.mode).toBe('report-only');
	expect(report.executedChecks).toBe(0);
	expect(report.source.scope).toBe('entity');
	expect(report.source.entity).toBe(ENTITY);
	expect(report.candidates).toEqual([]);
	expect(report.checks[0]?.decision).toBe('singleton');

	recordExampleCases(
		{
			unitId: 'workflow.verification-evidence-run-verify-verification-service-verify-plan-report',
			symbol: 'verifyPlanReport',
			state: 'reports-entity-scoped-planning-without-executing-checks',
			evidence: 'examples-cases',
			file: 'reports-entity-scoped-planning-without-executing-checks.json'
		},
		[
			{
				name: 'single vitest check under entity scope stays a singleton and is not executed',
				input: { plannedChecks: plan.map((check) => check.id), source: ENTITY_SOURCE },
				output: summarise(report)
			}
		]
	);
});
