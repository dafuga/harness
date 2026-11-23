import { explorerRoute, type ExplorerLocation } from '../../src/utils/explorerRoute';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

export const unitId = 'function.explorer-route';

export function parseRows(
	state: string,
	rows: readonly (readonly [string, string, string, ExplorerLocation | undefined])[]
): void {
	const cases = rows.map(([name, path, search]) => ({
		name,
		input: { path, search },
		output: explorerRoute(path, search)
	}));
	expect(cases.map((item) => item.output)).toEqual(rows.map((row) => row[3]));
	recordExampleCases(
		{ unitId, symbol: 'explorerRoute', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}
