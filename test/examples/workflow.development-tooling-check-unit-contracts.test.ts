import type { Report, Cases } from './workflow.development-tooling-check-unit-contracts.test.types';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	checkUnitContracts,
	renderContractCheck
} from '../../src/workflows/development-tooling/guide-units/checkUnitContracts';

const UNIT = 'workflow.development-tooling-check-unit-contracts';
const SELECTION = 'Select one unit identity or --all.';
const HEURISTIC = 'Heuristic review; not a completeness proof.';

const cleanReport: Report = {
	entities: [UNIT],
	findings: [],
	counts: [{ entity: UNIT, findings: 0 }],
	summary: { entities: 1, findings: 0 }
};

const WHERE = `specification/units/${UNIT}.json#contract`;
const DETAIL = 'Contract state default (GUESS): catalog variant missing, test missing.';

const findingReport: Report = {
	entities: [UNIT],
	findings: [{ entity: UNIT, kind: 'untested-state', detail: DETAIL, where: WHERE }],
	counts: [{ entity: UNIT, findings: 1 }],
	summary: { entities: 1, findings: 1 }
};

function record(state: string, symbol: string, cases: Cases): void {
	recordExampleCases(
		{ unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

async function captureError(
	run: () => Promise<unknown>
): Promise<{ name: string; message: string }> {
	try {
		await run();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	throw new Error('Expected the call to reject.');
}

test('Rejects when neither a unit id nor all is selected', async () => {
	const error = await captureError(() => checkUnitContracts(undefined, {}));
	expect(error.message).toBe(SELECTION);
	record('rejects-when-neither-a-unit-id-nor-all-is-selected', 'checkUnitContracts', [
		{ name: 'no id and no all flag', input: { id: null, options: {} }, error }
	]);
});

test('Rejects when both a unit id and all are selected', async () => {
	const error = await captureError(() => checkUnitContracts(UNIT, { all: true }));
	expect(error.message).toBe(SELECTION);
	record('rejects-when-both-a-unit-id-and-all-are-selected', 'checkUnitContracts', [
		{ name: 'id together with all', input: { id: UNIT, options: { all: true } }, error }
	]);
});

test('Renders a clean report as a heuristic total', () => {
	const output = renderContractCheck(cleanReport);
	expect(output).toBe(`${UNIT}: 0 findings\n0 findings across 1 entities. ${HEURISTIC}`);
	record('renders-a-clean-report-as-a-heuristic-total', 'renderContractCheck', [
		{ name: 'clean report with no findings', input: cleanReport, output }
	]);
});

test('Renders each finding with its entity, kind and location', () => {
	const output = renderContractCheck(findingReport);
	expect(output).toBe(
		[
			`${UNIT}: 1 findings`,
			`${UNIT} [untested-state] ${DETAIL}\n  ${WHERE}`,
			`1 findings across 1 entities. ${HEURISTIC}`
		].join('\n')
	);
	record('renders-each-finding-with-its-entity-kind-and-location', 'renderContractCheck', [
		{ name: 'one untested-state finding', input: findingReport, output }
	]);
});
