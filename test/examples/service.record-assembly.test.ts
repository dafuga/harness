import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { CheckOutcome } from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/CheckRunService.types';
import { recordVideoBatches } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/recordVideoBatches';

test('Omits video batches without admitted pointers', () => {
	const outcomes = [
		{ check: { id: 'unit-test' }, videoBatches: [] },
		{ check: { id: 'typecheck' }, videoBatches: [] }
	] as unknown as CheckOutcome[];
	const result = recordVideoBatches(outcomes);
	expect(result).toEqual({});
	recordExampleCases(
		{
			unitId: 'service.record-assembly',
			symbol: 'recordVideoBatches',
			state: 'omits-video-batches-without-admitted-pointers',
			evidence: 'examples-cases',
			file: 'omits-video-batches-without-admitted-pointers.json'
		},
		[
			{
				name: 'checks without video pointers produce no video batch field',
				input: { checkIds: outcomes.map(({ check }) => check.id) },
				output: result
			}
		]
	);
});
