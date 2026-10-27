import { expect } from 'vitest';
import type { TestContractService } from '../../src/services/verification-evidence/TestContractService';
import type { ContractUnit } from './testContractCases.types';
import type { ScenarioManifest } from '../../src/core/unitTypes';

/** New declared input capabilities may add their own row, never unrelated rows. */
export function assertDeclaredInputCapabilities(unit: ContractUnit, service: TestContractService) {
	for (const shape of ['api', 'page', 'component'] as const) assertShape(unit, service, shape);
}

function fixture(unit: ContractUnit, shape: 'api' | 'page' | 'component') {
	const state = shape === 'component' ? 'rest' : 'ready';
	const expected =
		shape === 'api'
			? { kind: 'json' as const, value: { ok: true } }
			: { kind: 'screenshot' as const, file: 'base.png' };
	const item = {
		...unit.testing.cases[0],
		state,
		expected,
		...(shape === 'api'
			? {}
			: { viewports: shape === 'page' ? ['desktop', 'tablet', 'mobile'] : ['desktop'] })
	};
	const before = {
		...unit,
		id: shape === 'api' ? 'endpoint.api-rank' : `${shape}.rank`,
		kind: shape === 'api' ? 'endpoint' : shape,
		testing: { ...unit.testing, shape, states: [state], cases: [item] }
	};
	const row = {
		...item,
		id: 'extra-row',
		input: { extra: true },
		test: { ...item.test, title: 'rank extra' }
	};
	return { item, before, row };
}

function assertShape(
	unit: ContractUnit,
	service: TestContractService,
	shape: 'api' | 'page' | 'component'
) {
	const { item, before, row } = fixture(unit, shape);
	const prop = {
		...before,
		testing: { ...before.testing, props: ['extra'], cases: [item, { ...row, props: ['extra'] }] }
	};
	const error = {
		...before,
		contract: { ...before.contract, errors: [{ name: 'Unavailable', type: 'response' }] },
		testing: { ...before.testing, cases: [item, { ...row, errors: ['Unavailable'] }] }
	};
	expect(service.compare([before], [prop]), `${shape}: declared prop can add its row`).toEqual([]);
	expect(service.compare([before], [error]), `${shape}: declared error can add its row`).toEqual(
		[]
	);
	const unrelated = {
		...prop,
		testing: {
			...prop.testing,
			cases: [...prop.testing.cases, { ...row, id: 'unrelated', input: { other: true } }]
		}
	};
	expect(service.compare([before], [unrelated]).join(' '), `${shape}: unrelated row`).toContain(
		'case identities/count changed'
	);
	const undeclared = {
		...before,
		testing: { ...before.testing, cases: [item, { ...row, props: ['extra'] }] }
	};
	expect(service.compare([before], [undeclared]).join(' '), `${shape}: undeclared prop`).toContain(
		'case identities/count changed'
	);
	const duplicate = {
		...prop,
		testing: {
			...prop.testing,
			cases: [...prop.testing.cases, { ...row, id: 'duplicate', props: ['extra'] }]
		}
	};
	expect(
		service.compare([before], [duplicate]).join(' '),
		`${shape}: duplicate prop row`
	).toContain('duplicate matrix row');
}

/** Strict visual scenarios must name real screenshot evidence for each referenced viewport. */
export function assertVisualScenarioEvidence(unit: ContractUnit, service: TestContractService) {
	for (const shape of ['page', 'component'] as const) {
		const { registry, scenario, evidence } = visualScenarioFixture(unit, shape);
		expect(service.validate(registry), shape).toEqual([]);
		assertVisualScenarioGaps(service, registry, scenario, evidence);
	}
}

function visualScenarioFixture(unit: ContractUnit, shape: 'page' | 'component') {
	const { item, before } = fixture(unit, shape);
	const viewports = item.viewports ?? [];
	const evidence: ScenarioManifest['evidence'][number] = {
		id: 'screens',
		kind: 'screenshot',
		states: [item.state],
		viewports,
		provenance: 'actual-capture',
		build: 'app',
		required: true
	};
	const scenario: ScenarioManifest = {
		schemaVersion: 1,
		id: 'visual',
		title: 'Visual case',
		kind: 'ui',
		units: [before.id],
		states: [{ id: item.state, title: item.state, coverage: 'required' }],
		viewports: viewports.map((id) => ({ id, width: 4, height: 4 })),
		tests: [
			{
				id: 'visual',
				kind: 'e2e',
				runner: 'playwright',
				target: item.test.file,
				cases: [{ unit: before.id, case: item.id }]
			}
		],
		evidence: [evidence]
	};
	const registry = {
		units: [before],
		scenarios: [scenario],
		files: new Set([item.test.file]),
		tests: [item.test],
		required: true
	};
	return { registry, scenario, evidence };
}

function assertVisualScenarioGaps(
	service: TestContractService,
	registry: Parameters<TestContractService['validate']>[0],
	scenario: ScenarioManifest,
	evidence: ScenarioManifest['evidence'][number]
) {
	const validate = (entry: ScenarioManifest, required = true) =>
		service.validate({ ...registry, scenarios: [entry], required }).join(' ');
	for (const slot of [
		{ ...evidence, required: false },
		{ ...evidence, kind: 'output' as const },
		{ ...evidence, states: ['other'] },
		{ ...evidence, viewports: [] }
	])
		expect(validate({ ...scenario, evidence: [slot] })).toContain('has no required screenshot');
	const last = evidence.viewports.at(-1)!;
	const partial = { ...evidence, viewports: evidence.viewports.slice(0, -1) };
	expect(validate({ ...scenario, evidence: [partial] })).toContain(`at viewport ${last}`);
	for (const provenance of [undefined, 'fixture'] as const)
		expect(validate({ ...scenario, evidence: [{ ...evidence, provenance }] })).toContain(
			'requires actual-capture provenance'
		);
	expect(
		validate({
			...scenario,
			evidence: [evidence, { ...evidence, id: 'other', provenance: 'fixture' }]
		})
	).toContain('requires actual-capture provenance');
	expect(validate({ ...scenario, evidence: [{ ...evidence, build: undefined }] })).toContain(
		'requires a declared build'
	);
	expect(validate({ ...scenario, viewports: [] })).toContain('viewport is not declared');
	expect(validate({ ...scenario, evidence: [] }, false)).toBe('');
}
