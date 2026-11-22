import type { ChangedFile } from '../../src/core/development-tooling/impactTypes';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const unitId = 'service.verification';
const evidence = 'examples-cases';

/** The state a test is named for: its title, lowercased, with runs of other characters as "-". */
function stateOf(title: string): string {
	const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
	const trimmed = slug.replace(/^-|-$/g, '');
	return trimmed.slice(0, 60).replace(/-$/, '');
}

/** Records the running test's named cases, each `[name, input, output]`, as the examples evidence. */
export function recordState(symbol: string, cases: [string, unknown, unknown][]) {
	const state = stateOf(expect.getState().currentTestName ?? '');
	const named = cases.map(([name, input, output]) => ({ name, input, output }));
	recordExampleCases({ unitId, symbol, state, evidence, file: `${state}.json` }, named);
}

export function fileChange(path: string, status: ChangedFile['status']): ChangedFile {
	return { path, status, classification: 'other' };
}
