import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { indexUnits } from '../../src/cli/program/manageUnits';
import { projectAt, slugifySource } from '../support/unitProject';
import { backfillUids } from '../../src/workflows/development-tooling/backfill-uids/backfillUids';

const unitId = 'workflow.development-tooling-backfill-uids-backfill-uids';
const state = 'plans-uid-assignments-without-writing';

test('Plans UID assignments without writing', async () => {
	await withTempRepo(async ({ root }) => {
		const project = projectAt(root);
		const source = 'src/utils/slugify.ts';
		const manifest = 'specification/units/function.slugify.json';
		await project.write(source, slugifySource);
		await indexUnits({ root, write: true });
		const before = await project.read(manifest);
		const report = await backfillUids({ root });
		expect(report).toEqual({
			units: 1,
			assigned: [{ id: 'function.slugify', uid: expect.stringMatching(/^u_[a-z0-9]{10}$/) }],
			annotated: [source],
			registryOnly: [],
			conflicts: [],
			written: 0
		});
		expect(await project.read(source)).toBe(slugifySource);
		expect(await project.read(manifest)).toBe(before);
		recordExampleCases(
			{
				unitId,
				symbol: 'backfillUids',
				state,
				evidence: 'examples-cases',
				file: `${state}.json`
			},
			[
				{
					name: 'an unlabelled source and registry entry are planned without modification',
					input: { root: 'fixture project with function.slugify' },
					output: report
				}
			]
		);
	});
});

const errorState = 'throws-error-when-loading-units-fails';

test('Throws Error when loading units fails', async () => {
	await withTempDir('backfill-uids-error-', async (directory) => {
		const input = { root: `${directory}/missing-project` };
		let failure: unknown;
		try {
			await backfillUids(input);
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(Error);
		const error = failure instanceof Error ? { name: failure.name, message: failure.message } : {};
		recordExampleCases(
			{
				unitId,
				symbol: 'backfillUids',
				state: errorState,
				evidence: 'examples-cases',
				file: `${errorState}.json`
			},
			[{ name: 'a missing project root propagates the load failure', input, error }]
		);
	});
});
