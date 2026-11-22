import { test } from 'vitest';
import * as verification from '../../src/lib/verification';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const runtimeExports = [
	'BuildIdentityService',
	'PerformanceProfileService',
	'TaskCompletionService',
	'benchmarkCaptureSchema',
	'budgetEventSchema',
	'budgetFindings',
	'buildIdentity',
	'captureIndex',
	'captureLineSchema',
	'comparisonContext',
	'comparisonDifferences',
	'comparisonSchema',
	'defaultVerifyConfig',
	'evidenceRequested',
	'explanationOutcomes',
	'explanationSchema',
	'frozenMetrics',
	'mediaFacts',
	'measurementBoundaries',
	'metricUnits',
	'performanceBaselineSchema',
	'performanceLimit',
	'recordCapture',
	'recordIntact',
	'reportedMeasurementSchema',
	'requestDigest',
	'roundsProtocol',
	'scenarioRequirements',
	'sealRecord',
	'verifyConfigSchema',
	'workloadSchema'
];

test('Exposes the public verification contracts', () => {
	const names = Object.keys(verification).sort();
	expect(names).toEqual([...runtimeExports].sort());
	expect(typeof verification.BuildIdentityService).toBe('function');
	expect(verification.explanationSchema).toBeDefined();
	recordExampleCases(
		{
			unitId: 'module.verification',
			symbol: 'verification',
			state: 'exposes-the-public-verification-contracts',
			evidence: 'examples-cases',
			file: 'exposes-the-public-verification-contracts.json'
		},
		[
			{
				name: 'importing the entry module exposes its runtime exports without side effects',
				input: {},
				output: { count: names.length, exports: names }
			}
		]
	);
});
