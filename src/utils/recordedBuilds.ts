import type { VerificationRecord } from '../core/verificationTypes';

type RecordedBuild = NonNullable<VerificationRecord['builds']>[number];

/**
 * What a record keeps of the builds a run observed: where each one is and the identity of its
 * files. The record names its fields and does not copy what it is given, so anything else an
 * observation carries, such as the stamp it was judged by, stays out of the record. A project
 * that declares no build has no entry at all.
 */
export function recordedBuilds(observed?: RecordedBuild[]): Pick<VerificationRecord, 'builds'> {
	if (!observed) return {};
	return {
		builds: observed.map(({ id, directory, buildId, files }) => ({ id, directory, buildId, files }))
	};
}
