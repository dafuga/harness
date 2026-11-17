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

test('Throws ExpectedCliError when batch pointers conflict across checks', () => {
	const outcomes = [
		{ check: { id: 'desktop' }, videoBatches: [{ batch: 'batch-1', pointer: 'capture-a' }] },
		{ check: { id: 'mobile' }, videoBatches: [{ batch: 'batch-1', pointer: 'capture-b' }] }
	] as unknown as CheckOutcome[];
	const message = 'Video batch pointer identity conflicts across checks.';
	expect(() => recordVideoBatches(outcomes)).toThrow(message);
	recordExampleCases(
		{
			unitId: 'service.record-assembly',
			symbol: 'recordVideoBatches',
			state: 'throws-expectedclierror-when-batch-pointers-conflict-across',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-batch-pointers-conflict-across.json'
		},
		[
			{
				name: 'same batch with different pointers is rejected',
				input: { batch: 'batch-1', pointers: ['capture-a', 'capture-b'] },
				error: { name: 'ExpectedCliError', message }
			}
		]
	);
});
