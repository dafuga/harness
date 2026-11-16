import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { FrameFlagService } from '../../src/services/verification-evidence/FrameFlagService';

const unitId = 'service.frame-flag-example';
const otherUnitId = 'service.other-example';
const meta = {
	unitId: 'service.verification-evidence-frame-flag',
	evidence: 'examples-cases'
};

test('Lists no flags for a unit without stored feedback', async () => {
	await withTempRepo(async (repository) => {
		const service = new FrameFlagService(repository.root);
		const flags = await service.list(unitId);
		const otherFlags = await service.list(otherUnitId);
		expect(flags).toEqual([]);
		expect(otherFlags).toEqual([]);
		const state = 'lists-no-flags-for-a-unit-without-stored-feedback';
		recordExampleCases(
			{ ...meta, symbol: 'list', state, file: `${state}.json` },
			[
				{ name: 'example unit has no retained flags', input: { unit: unitId }, output: flags },
				{ name: 'other unit has no retained flags', input: { unit: otherUnitId }, output: otherFlags }
			]
		);
	});
});

test('Rejects a frame request for a flag that was never stored', async () => {
	await withTempRepo(async (repository) => {
		const service = new FrameFlagService(repository.root);
		let error: unknown;
		try {
			await service.frame(unitId, 'flag-never-stored');
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		const state = 'rejects-a-frame-request-for-a-flag-that-was-never-stored';
		recordExampleCases(
			{ ...meta, symbol: 'frame', state, file: `${state}.json` },
			[
				{
					name: 'unknown flag id for an example unit rejects',
					input: { unit: unitId, id: 'flag-never-stored' },
					error: {
						name: (error as Error).name,
						message: (error as Error).message
					}
				}
			]
		);
	});
});
