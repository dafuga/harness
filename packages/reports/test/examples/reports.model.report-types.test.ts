import { test } from 'vitest';
import * as reportTypes from '../../src/models/reports-media/Report.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The Report model declares types only, so its source module has no runtime values. */
const ownedTypeNames = [
	'EvidenceVideo',
	'Status',
	'Check',
	'Evidence',
	'Finding',
	'Coverage',
	'Exports',
	'Report',
	'BeginInput',
	'RecordInput'
];

test('Importing the Report model returns no runtime value', () => {
	const runtimeExports = Object.keys(reportTypes);
	const runtimeValues = ownedTypeNames.filter((name) => name in reportTypes);

	expect(runtimeExports).toEqual([]);
	expect(runtimeValues).toEqual([]);
	recordExampleCases(
		{
			unitId: 'reports.model.report-types',
			symbol: 'Report.types',
			state: 'importing-the-report-model-returns-no-runtime-value',
			evidence: 'examples-cases',
			file: 'importing-the-report-model-returns-no-runtime-value.json'
		},
		[
			{
				name: 'import the model from its source file',
				input: {
					module: 'packages/reports/src/models/reports-media/Report.types.ts'
				},
				output: { runtimeExports }
			},
			{
				name: 'look up each type the model owns in the loaded module',
				input: { names: ownedTypeNames },
				output: { runtimeValues }
			}
		]
	);
});
