import type { VerificationRecord } from '../../../../../core/verification-evidence/verificationTypes';

export type RecordedBuild = NonNullable<VerificationRecord['builds']>[number];
