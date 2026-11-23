import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	budgetFindingSchema,
	captureSchema,
	componentVersionSchema,
	measurementSchema,
	profileSchema
} from '../../src/core/verification-evidence/verificationTypes';

const sha = 'a'.repeat(64);
const commit = 'b'.repeat(40);

function meta(symbol: string, state: string) {
	return {
		unitId: 'function.verification-types',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

function rejection(result: {
	success: boolean;
	error?: { issues: Array<{ path: PropertyKey[] }> };
}): string[] {
	return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

const screenshot = {
	evidence: 'fixture-login-screen',
	kind: 'screenshot',
	state: 'signed-out',
	viewport: 'desktop',
	clip: { x: 0, y: 12, width: 320, height: 180 },
	status: 'passed',
	path: 'captures/signed-out.png',
	sha256: sha,
	bytes: 2048,
	mediaType: 'image/png',
	capturedAt: '2026-11-17T10:00:00.000Z',
	provenance: 'fixture'
};

const profile = {
	id: 'fixture-profile',
	platform: 'darwin',
	arch: 'arm64',
	cpu: 'fixture-cpu',
	cores: 8,
	memoryBytes: 17179869184,
	runtime: 'node-22'
};

const component = {
	unit: 'function.example',
	change: 'modified',
	target: 'module',
	manifest: sha,
	source: sha,
	contract: sha,
	runtime: sha,
	files: [{ path: 'src/example.ts', hash: commit }]
};

const unavailableMeasurement = {
	unit: 'function.example',
	metric: 'latency-cold-ms',
	unitOfMeasure: 'ms',
	value: null,
	unavailable: 'no runtime in this fixture',
	method: 'timed-import',
	workload: null,
	profile: null,
	testedRevision: commit,
	artifacts: []
};

test('Capture schema accepts a clipped screenshot', () => {
	const badDigest = { ...screenshot, sha256: 'not-a-digest' };
	const valid = captureSchema.safeParse(screenshot);
	const invalid = captureSchema.safeParse(badDigest);
	expect(valid.success).toBe(true);
	expect(rejection(invalid)).toEqual(['sha256']);
	recordExampleCases(meta('captureSchema', 'capture-schema-accepts-a-clipped-screenshot'), [
		{
			name: 'clipped screenshot with a sha256 digest',
			input: screenshot,
			output: { valid: valid.success }
		},
		{
			name: 'screenshot whose sha256 is not a hex digest',
			input: { path: screenshot.path, sha256: 'not-a-digest' },
			error: rejection(invalid)
		}
	]);
});

test('Profile and component schemas accept complete identities', () => {
	const profileResult = profileSchema.safeParse(profile);
	const componentResult = componentVersionSchema.safeParse(component);
	const zeroCores = profileSchema.safeParse({ ...profile, cores: 0 });
	expect(profileResult.success).toBe(true);
	expect(componentResult.success).toBe(true);
	expect(rejection(zeroCores)).toEqual(['cores']);
	recordExampleCases(
		meta('profileSchema', 'profile-and-component-schemas-accept-complete-identities'),
		[
			{
				name: 'darwin arm64 profile with eight cores',
				input: profile,
				output: { valid: profileResult.success }
			},
			{
				name: 'profile reporting zero cores',
				input: { cores: 0 },
				error: rejection(zeroCores)
			},
			{
				name: 'modified module component with hashed files',
				input: component,
				output: { valid: componentResult.success }
			}
		]
	);
});

test('Measurement schema accepts an unavailable measurement', () => {
	const result = measurementSchema.safeParse(unavailableMeasurement);
	const withoutRevision = measurementSchema.safeParse({
		...unavailableMeasurement,
		testedRevision: 'short'
	});
	expect(result.success).toBe(true);
	expect(rejection(withoutRevision)).toEqual(['testedRevision']);
	recordExampleCases(
		meta('measurementSchema', 'measurement-schema-accepts-an-unavailable-measurement'),
		[
			{
				name: 'cold latency that cannot be measured in the fixture',
				input: unavailableMeasurement,
				output: { valid: result.success, value: null }
			},
			{
				name: 'measurement whose tested revision is not a commit hash',
				input: { testedRevision: 'short' },
				error: rejection(withoutRevision)
			}
		]
	);
});

test('Budget finding schema accepts an unavailable metric', () => {
	const unavailable = {
		unit: 'function.example',
		metric: 'latency-cold-ms',
		status: 'unavailable',
		baseline: null,
		measured: null,
		detail: 'the reviewed baseline also says it cannot be measured'
	};
	const exceeded = {
		unit: 'function.example',
		metric: 'bundle-bytes',
		status: 'exceeded',
		baseline: 1000,
		measured: 1500,
		target: 'wasm'
	};
	const unavailableResult = budgetFindingSchema.safeParse(unavailable);
	const exceededResult = budgetFindingSchema.safeParse(exceeded);
	expect(unavailableResult.success).toBe(true);
	expect(exceededResult.success).toBe(true);
	recordExampleCases(
		meta('budgetFindingSchema', 'budget-finding-schema-accepts-an-unavailable-metric'),
		[
			{
				name: 'unavailable metric stated, not judged, with null values',
				input: unavailable,
				output: { valid: unavailableResult.success, status: 'unavailable' }
			},
			{
				name: 'exceeded wasm bundle size against its baseline',
				input: exceeded,
				output: { valid: exceededResult.success, status: 'exceeded' }
			}
		]
	);
});
