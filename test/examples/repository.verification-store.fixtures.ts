import { relative } from 'node:path';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';

const unitId = 'repository.verification-store';

export const commit = '89abcdef0123456789abcdef0123456789abcdef';

const tree = '0123456789abcdef0123456789abcdef01234567';

export function buildRecord(
	id: string,
	startedAt: string,
	status: 'passed' | 'failed' = 'passed',
	sourceCommit = commit
): VerificationRecord {
	return {
		id,
		schemaVersion: 1,
		repository: '/workspace/project',
		source: { commit: sourceCommit, tree, base: null },
		profile: {
			id: 'linux-x64-node22',
			platform: 'linux',
			arch: 'x64',
			cpu: 'AMD EPYC 7B13',
			cores: 4,
			memoryBytes: 8589934592,
			runtime: 'node 22.15.0'
		},
		startedAt,
		finishedAt: '2026-11-16T09:08:12.456Z',
		status,
		components: [],
		measurements: [],
		impact: {
			runtime: 'module',
			expanded: false,
			changed: [],
			units: { direct: [], indirect: [], added: [], removed: [] },
			uncertain: []
		},
		tests: [],
		scenarios: [],
		budgets: { status: 'passed', findings: [] },
		reasons: { status: 'passed', missing: [] },
		failures: []
	};
}

export function storedSummary(
	stored: { record: VerificationRecord; directory: string } | undefined,
	root: string
) {
	return stored
		? {
				id: stored.record.id,
				commit: stored.record.source.commit,
				startedAt: stored.record.startedAt,
				status: stored.record.status,
				directory: relative(root, stored.directory)
			}
		: null;
}

export function recordCases(
	symbol: string,
	state: string,
	cases: Parameters<typeof recordExampleCases>[1]
): void {
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

export function withStore<T>(
	use: (root: string, repository: VerificationStoreRepository) => Promise<T> | T
): Promise<T> {
	return withTempDir('repository-verification-store-', (root) =>
		use(root, new VerificationStoreRepository(root))
	);
}
