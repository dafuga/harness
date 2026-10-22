import { createHash } from 'node:crypto';
import type { VerificationRecord } from '../../core/verification-evidence/verificationTypes';
import { canonicalJson } from '../development-tooling/canonicalJson';

/** Seals a record: its id is the hash of everything else in it. */
export function sealRecord(draft: Omit<VerificationRecord, 'id'>): VerificationRecord {
	// Key order is not part of a record's meaning, so it is not part of its identity either.
	const id = createHash('sha256').update(canonicalJson(draft)).digest('hex');
	return { id, ...draft };
}

export function recordIntact(record: VerificationRecord): boolean {
	const { id, ...draft } = record;
	return sealRecord(draft).id === id;
}

export {
	recordComponents,
	benchmarkMeasurements
} from '../../workflows/verification-evidence/run-verify/verification-service/record-assembly-service/sealRecord';
export { referencedScenario } from '../../workflows/verification-evidence/run-verify/verification-service/sealRecord';
