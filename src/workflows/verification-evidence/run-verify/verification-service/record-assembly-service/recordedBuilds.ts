// @harness-uid u_giupyfzlvs
import type { RecordedBuild } from './recordedBuilds.types';
import type { VerificationRecord } from '../../../../../core/verification-evidence/verificationTypes';

/**
 * What a record keeps of the builds a run observed: where each one is and the identity of its
 * files. The record names its fields and does not copy what it is given, so anything else an
 * observation carries, such as the stamp it was judged by, stays out of the record. A project
 * that declares no build has no entry at all. The ids of the declared builds an entity-scoped run
 * skipped are kept beside them when given, and are absent otherwise.
 */
export function recordedBuilds(
	observed?: RecordedBuild[],
	skipped?: string[]
): Pick<VerificationRecord, 'builds' | 'skippedBuilds'> {
	const skippedBuilds = skipped ? { skippedBuilds: [...skipped] } : {};
	if (!observed) return skippedBuilds;
	return {
		...skippedBuilds,
		builds: observed.map(({ id, directory, buildId, files }) => ({ id, directory, buildId, files }))
	};
}
