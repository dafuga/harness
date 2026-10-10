import type {
	Measurement,
	RecordedComponent,
	VerificationRecord
} from '../../src/core/verificationTypes';

const commit = 'a'.repeat(40);
const digest = 'b'.repeat(64);

/** A complete record for one modified unit, usable without any repository at hand. */
export function verificationSample(): VerificationRecord {
	return {
		schemaVersion: 1,
		id: 'record-1',
		repository: 'c'.repeat(40),
		source: { commit, tree: 'd'.repeat(40), base: null },
		profile: {
			id: 'profile-1',
			platform: 'darwin',
			arch: 'arm64',
			cpu: 'Example CPU',
			cores: 8,
			memoryBytes: 17179869184,
			runtime: 'bun 1.2.18'
		},
		startedAt: '2026-10-10T00:00:00.000Z',
		finishedAt: '2026-10-10T00:00:05.000Z',
		status: 'passed',
		components: sampleComponents(),
		measurements: sampleMeasurements(),
		impact: {
			runtime: 'module',
			expanded: false,
			changed: [{ path: 'src/utils/rank.ts', status: 'modified', classification: 'source' }],
			units: { direct: ['function.rank'], indirect: [], added: [], removed: [] },
			uncertain: []
		},
		tests: [],
		scenarios: [],
		budgets: { status: 'passed', findings: [] },
		reasons: { status: 'passed', missing: [] },
		failures: []
	};
}

function sampleComponents(): RecordedComponent[] {
	return [
		{
			unit: 'function.rank',
			change: 'modified',
			target: 'module',
			manifest: digest,
			source: digest,
			contract: digest,
			runtime: digest,
			files: [{ path: 'src/utils/rank.ts', hash: 'e'.repeat(40) }]
		}
	];
}

function sampleMeasurements(): Measurement[] {
	return [
		{
			unit: 'function.rank',
			metric: 'source-bytes',
			unitOfMeasure: 'bytes',
			value: 64,
			method: 'Sum of owned source blob sizes.',
			workload: null,
			profile: null,
			testedRevision: commit,
			artifacts: []
		},
		{
			unit: 'function.rank',
			metric: 'memory-bytes',
			unitOfMeasure: 'bytes',
			value: null,
			unavailable: 'In-process module memory cannot be attributed to one unit.',
			method: 'Not measured.',
			workload: 'rank-1k',
			profile: 'profile-1',
			target: 'module',
			testedRevision: commit,
			artifacts: []
		}
	];
}
