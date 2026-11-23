import { test } from 'vitest';
import {
	explanationOutcomes,
	explanationSchema
} from '../../src/core/development-tooling/explanationTypes';
import type { Explanation } from '../../src/core/development-tooling/explanationTypes.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const validReason = {
	unit: 'function.explanation-types',
	symbol: 'explanationSchema',
	change: 'modified',
	from: 'fingerprint-before',
	to: 'fingerprint-after',
	behavior: 'Rejects malformed change explanations.',
	simplification: { attempt: 'Keep one shared strict schema.', outcome: 'improved' },
	performance: { attempt: 'Validate at the recording boundary.', outcome: 'not-applicable' },
	recordedAt: '2026-11-16T10:00:00.000Z'
} satisfies Explanation;

test('Explanation schema accepts complete reasons and rejects unknown fields', () => {
	const parsed = explanationSchema.parse(validReason);
	const invalid = explanationSchema.safeParse({ ...validReason, unexpected: true });
	const invalidSummary = invalid.success
		? { success: true }
		: { success: false, issueCodes: invalid.error.issues.map((issue) => issue.code) };

	expect(explanationOutcomes).toEqual(['improved', 'not-improved', 'not-applicable']);
	expect(parsed).toEqual(validReason);
	expect(invalid.success).toBe(false);
	recordExampleCases(
		{
			unitId: 'function.explanation-types',
			symbol: 'explanationSchema',
			state: 'explanation-schema-accepts-complete-reasons-and-rejects-unkn',
			evidence: 'examples-cases',
			file: 'explanation-schema-accepts-complete-reasons-and-rejects-unkn.json'
		},
		[
			{ name: 'complete explanation for a modified function', input: validReason, output: parsed },
			{
				name: 'unknown keys are rejected by the strict schema',
				input: { ...validReason, unexpected: true },
				output: invalidSummary
			}
		]
	);
});
