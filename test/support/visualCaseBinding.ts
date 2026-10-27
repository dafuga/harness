import { expect } from 'vitest';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import { caseGate } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/caseGate';
import type { ContractUnit } from './testContractCases.types';
import { visualScenarioFixture } from './testCapabilityCases';

const revision = 'a'.repeat(40);
const sha256 = 'b'.repeat(64);

/** Exercise case, viewport, captured bytes and retry through the existing class validation case. */
export function assertVisualCaseBinding(unit: ContractUnit, service: TestContractService) {
	for (const shape of ['page', 'component'] as const) {
		const fixture = visualScenarioFixture(unit, shape);
		const item = fixture.registry.units[0].testing.cases[0];
		const outcome = { ...item.test, revision, retry: 0, status: 'passed' as const };
		const execution = { revision, files: [item.test.file], outcomes: [outcome] };
		const captures = fixture.evidence.viewports.map((viewport) =>
			visualCapture(
				{ unit: fixture.registry.units[0].id, caseId: item.id, state: item.state },
				viewport,
				0
			)
		);
		const visual = { scenario: fixture.scenario.id, check: 'visual', captures };
		const run = (input: object) =>
			service.validate({ ...fixture.registry, execution: input } as Parameters<
				TestContractService['validate']
			>[0]);
		expect(run(execution).join(' ')).toContain('missing case-bound screenshot');
		expect(run({ ...execution, visual })).toEqual([]);
		assertDamagedCaptures(run, execution, visual);
		assertRetriedCaptures(run, execution, visual);
		assertCaseGateForwarding(fixture, execution, visual);
		assertSiblingScenarioCheck(fixture, service, execution, visual);
	}
}

function visualCapture(
	identity: { unit: string; caseId: string; state: string },
	viewport: string,
	retry: number
) {
	const note = JSON.stringify({
		unit: identity.unit,
		case: identity.caseId,
		revision,
		sha256,
		retry
	});
	return {
		evidence: 'screens',
		kind: 'screenshot' as const,
		state: identity.state,
		viewport,
		sha256,
		note,
		provenance: 'actual-capture' as const,
		server: { revision, buildId: 'c'.repeat(64) }
	};
}

function assertDamagedCaptures(
	run: (execution: object) => string[],
	execution: object,
	visual: { scenario: string; check: string; captures: ReturnType<typeof visualCapture>[] }
) {
	const [first, ...remaining] = visual.captures;
	const note = JSON.parse(first.note);
	const variants = [
		{ ...first, note: undefined },
		{ ...first, note: '{bad' },
		{ ...first, note: JSON.stringify({ ...note, unit: 'page.other' }) },
		{ ...first, note: JSON.stringify({ ...note, case: 'other' }) },
		{ ...first, note: JSON.stringify({ ...note, revision: 'd'.repeat(40) }) },
		{ ...first, note: JSON.stringify({ ...note, sha256: 'd'.repeat(64) }) },
		{ ...first, note: JSON.stringify({ ...note, retry: 1 }) },
		{ ...first, state: 'other' },
		{ ...first, evidence: 'other' },
		{ ...first, provenance: 'fixture' as const },
		{ ...first, server: { ...first.server, revision: 'd'.repeat(40) } }
	];
	for (const changed of variants) {
		const errors = run({ ...execution, visual: { ...visual, captures: [changed, ...remaining] } });
		expect(errors.join(' ')).toContain('missing case-bound screenshot');
		expect(errors.join(' ')).toContain('unbound screenshot');
	}
	const duplicate = run({
		...execution,
		visual: { ...visual, captures: [...visual.captures, first] }
	});
	expect(duplicate.join(' ')).toContain('ambiguous screenshot case evidence');
	const sibling = { ...first, note: JSON.stringify({ ...note, unit: 'page.other' }) };
	expect(
		run({ ...execution, visual: { ...visual, captures: [...visual.captures, sibling] } }).join(' ')
	).toContain('unbound screenshot');
}

function assertRetriedCaptures(
	run: (execution: object) => string[],
	execution: {
		outcomes: { file: string; title: string; revision: string; retry: number; status: 'passed' }[];
	},
	visual: { scenario: string; check: string; captures: ReturnType<typeof visualCapture>[] }
) {
	const first = execution.outcomes[0];
	const outcomes = [
		{ ...first, status: 'failed' as const },
		{ ...first, retry: 1 }
	];
	const latest = visual.captures.map((capture) => {
		const note = JSON.parse(capture.note);
		return { ...capture, note: JSON.stringify({ ...note, retry: 1 }) };
	});
	expect(run({ ...execution, outcomes, visual }).join(' ')).toContain(
		'missing case-bound screenshot'
	);
	expect(
		run({
			...execution,
			outcomes,
			visual: { ...visual, captures: [...visual.captures, ...latest] }
		})
	).toEqual([]);
	const legacy = visual.captures.map((capture) => {
		const note = JSON.parse(capture.note) as Record<string, unknown>;
		delete note.retry;
		return { ...capture, note: JSON.stringify(note) };
	});
	expect(run({ ...execution, visual: { ...visual, captures: legacy } })).toEqual([]);
	expect(
		run({ ...execution, outcomes, visual: { ...visual, captures: legacy } }).join(' ')
	).toContain('missing case-bound screenshot');
}

function assertCaseGateForwarding(
	fixture: ReturnType<typeof visualScenarioFixture>,
	execution: {
		outcomes: { file: string; title: string; revision: string; retry: number; status: 'passed' }[];
	},
	visual: { scenario: string; check: string; captures: ReturnType<typeof visualCapture>[] }
) {
	const head = {
		config: { testing: 1 },
		stored: fixture.registry.units,
		scenarios: [fixture.scenario],
		entries: [{ path: execution.outcomes[0].file }]
	} as unknown as Parameters<typeof caseGate>[0];
	const check = {
		id: 'visual:visual',
		scenario: 'visual',
		name: 'visual',
		target: execution.outcomes[0].file,
		cwd: '.'
	};
	const gathered = visual.captures.map((capture) => ({
		line: capture,
		capture: { sha256: capture.sha256 }
	}));
	const outcome = { check, entry: { cases: { outcomes: execution.outcomes } }, gathered };
	const run = (input: object) =>
		caseGate(head, revision, [input as Parameters<typeof caseGate>[2][number]]);
	expect(run(outcome)).toEqual([]);
	expect(run({ ...outcome, gathered: [] }).join(' ')).toContain('missing case-bound screenshot');
}

function assertSiblingScenarioCheck(
	fixture: ReturnType<typeof visualScenarioFixture>,
	service: TestContractService,
	execution: { revision: string; files: string[]; outcomes: object[] },
	visual: { scenario: string; check: string; captures: ReturnType<typeof visualCapture>[] }
) {
	const unit = fixture.registry.units[0];
	const first = unit.testing.cases[0];
	const sibling = {
		...first,
		id: 'sibling',
		state: 'other',
		test: { ...first.test, title: 'other' }
	};
	const expanded = {
		...unit,
		testing: { ...unit.testing, states: [...unit.testing.states, 'other'], cases: [first, sibling] }
	};
	const scenario = {
		...fixture.scenario,
		states: [
			...fixture.scenario.states,
			{ id: 'other', title: 'Other', coverage: 'required' as const }
		],
		evidence: [{ ...fixture.evidence, states: [...fixture.evidence.states, 'other'] }],
		tests: [
			...fixture.scenario.tests,
			{ ...fixture.scenario.tests[0], id: 'sibling', cases: [{ unit: unit.id, case: sibling.id }] }
		]
	};
	const registry = {
		...fixture.registry,
		units: [expanded],
		scenarios: [scenario],
		tests: [first.test, sibling.test],
		execution: {
			...execution,
			outcomes: [...execution.outcomes, { ...sibling.test, revision, retry: 0, status: 'passed' }],
			visual
		}
	};
	expect(service.validate(registry as Parameters<TestContractService['validate']>[0])).toEqual([]);
}
