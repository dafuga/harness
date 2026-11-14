import { expect, test } from 'vitest';
import { VerificationRecordValidator } from '../../src/validators/verification-evidence/VerificationRecordValidator';
import type { Executed } from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService';
import {
	RecordAssemblyService,
	type AssemblyContext
} from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/RecordAssemblyService';

const validator = new VerificationRecordValidator();
const commit = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const buildId = 'c'.repeat(64);
/** A revision with no units, scenarios or ledger, so assembly judges only what the run saw. */
const revision = { manifests: [], stored: [], scenarios: [] };

/** Assembles the record of a run that observed or skipped these builds; nothing else is judged. */
async function assembleRun(observed: Pick<Executed, 'builds' | 'skippedBuilds'>) {
	const impact = {
		base: commit,
		head: commit,
		runtime: 'module',
		expanded: false,
		changed: [],
		units: { direct: [], indirect: [], added: [], removed: [] },
		tests: { selected: [], excluded: [], removed: [] },
		scenarios: { affected: [], unaffected: [] },
		uncertain: []
	};
	const context = {
		root: '/repo',
		commit,
		tree,
		baseCommit: null,
		requestedBase: null,
		base: revision,
		head: revision,
		impact,
		profile: {
			id: 'test',
			platform: 'darwin',
			arch: 'arm64',
			cpu: 'test',
			cores: 1,
			memoryBytes: 1,
			runtime: 'bun'
		},
		explained: async () => ({ required: [], entries: [], overlong: [], failures: [] })
	} as unknown as AssemblyContext;
	const executed: Executed = {
		outcomes: [],
		mutated: [],
		added: [],
		setupFailures: [],
		tools: [],
		artifacts: {},
		buildFailures: [],
		...observed
	};
	return new RecordAssemblyService(context).assemble({
		startedAt: '2026-11-14T00:00:00.000Z',
		executed,
		scenarios: [],
		referenced: []
	});
}

test('a scoped run names the declared builds it skipped, beside the builds it identified', async () => {
	const record = await assembleRun({
		builds: [{ id: 'web', directory: 'web/dist', buildId, files: 1 }],
		skippedBuilds: ['docs']
	});
	expect(record.builds).toEqual([{ id: 'web', directory: 'web/dist', buildId, files: 1 }]);
	expect(record.skippedBuilds).toEqual(['docs']);
	expect(validator.validate(record).errors).toEqual([]);
});

test('a full run skips no build, so its record leaves skippedBuilds out', async () => {
	const record = await assembleRun({});
	expect(record).not.toHaveProperty('skippedBuilds');
	expect(validator.validate(record).errors).toEqual([]);
});

test('a scoped run that skipped no declared build leaves skippedBuilds out too, so its record is unchanged', async () => {
	const record = await assembleRun({ skippedBuilds: [] });
	expect(record).not.toHaveProperty('skippedBuilds');
	expect(validator.validate(record).errors).toEqual([]);
});
