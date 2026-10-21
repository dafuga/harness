import { expect, test } from 'vitest';
import { comparisonSchema, roundsProtocol, warmupCalls } from '../../src/core/comparisonTypes';
import { taskProfile } from '../support/taskProfiles';
import {
	comparisonContext,
	requestDigest
} from '../../src/utils/comparison-context/comparisonContext';

const request = { operation: 'rank', input: { size: 20000, seed: 7 } };

test('requestDigest covers the whole request and ignores key order', () => {
	expect(requestDigest(request)).toMatch(/^[0-9a-f]{64}$/);
	expect(requestDigest({ input: { seed: 7, size: 20000 }, operation: 'rank' })).toBe(
		requestDigest(request)
	);
	expect(requestDigest({ ...request, input: { size: 20000, seed: 8 } })).not.toBe(
		requestDigest(request)
	);
	expect(requestDigest({ operation: 'rank' })).not.toBe(requestDigest(request));
});

test('comparisonContext states the request, the boundary and the sampling that were used', async () => {
	const context = comparisonContext(request, { rounds: 5, iterations: 30 });
	await taskProfile('function.comparison-types', 'parse-rank-comparison-context', () =>
		comparisonSchema.parse(context)
	);
	expect(context).toEqual({
		request: requestDigest(request),
		boundary: 'public-invocation',
		protocol: roundsProtocol,
		sampling: { warmup: warmupCalls, rounds: 5, iterations: 30 }
	});
	expect(comparisonSchema.safeParse(context).success).toBe(true);
	expect(comparisonSchema.safeParse({ ...context, request: 'rank-20k' }).success).toBe(false);
	expect(comparisonSchema.safeParse({ ...context, boundary: 'inner-function' }).success).toBe(
		false
	);
	expect(comparisonSchema.safeParse({ ...context, label: 'extra' }).success).toBe(false);
});
