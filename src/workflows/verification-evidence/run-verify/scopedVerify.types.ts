import type { VerifyContext } from './verification-service/VerificationService.types';

export type Base = Omit<
	VerifyContext,
	'impact' | 'requirePerformance' | 'testTimeoutMs' | 'entity' | 'env' | 'explained'
>;
