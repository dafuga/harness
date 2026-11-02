// @harness-uid u_i3fro6o4fu
import type { EmailProofService } from '../../../../services/verification-evidence/email-proof-service/EmailProofService';
import type { RequestSessionService } from './request-session-service/RequestSessionService';

export interface EmailProofControllerOptions {
	proofs: EmailProofService;
	sessions: RequestSessionService;
}
