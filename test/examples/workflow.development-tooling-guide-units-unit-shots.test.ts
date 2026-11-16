import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { unitShots } from '../../src/workflows/development-tooling/guide-units/unitShots';
import type { UnitShots } from '../../src/workflows/development-tooling/guide-units/unitShots.types';

const commit = '4c1e9a07b2d8f3e5a6c0917d4b28e1f0a3c5d967';
const entities = ['reports.component.evidence-grid', 'reports.function.explorer-evidence'];
const noEvidence: UnitShots = {
	captures: [],
	gap: 'No attached Harness verification evidence at this revision.'
};

test('Reports no attached evidence when no Harness refs exist', async () => {
	await withTempRepo(async (repository) => {
		const results = await Promise.all(
			entities.map((entity) => unitShots(repository.root, entity, commit))
		);

		expect(results).toEqual([noEvidence, noEvidence]);
		recordExampleCases(
			{
				unitId: 'workflow.development-tooling-guide-units-unit-shots',
				symbol: 'unitShots',
				state: 'reports-no-attached-evidence-when-no-harness-refs-exist',
				evidence: 'examples-cases',
				file: 'reports-no-attached-evidence-when-no-harness-refs-exist.json'
			},
			entities.map((entity, index) => ({
				name: `temporary repository without Harness refs for ${entity}`,
				input: { entity, commit },
				output: results[index]
			}))
		);
	}, 'unit-shots-');
});
