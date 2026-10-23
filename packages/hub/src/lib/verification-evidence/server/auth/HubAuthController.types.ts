import type { RequestSessionService } from './request-session-service/RequestSessionService';
import type { SessionRepository } from '../../../../repositories/projects-sessions/SessionRepository';
import type { LoginChallengeService } from '../../../../services/accounts-access/LoginChallengeService';
import type { GoogleIdentityService } from './GoogleIdentityService';
import type { EmailProofService } from '../../../../services/verification-evidence/email-proof-service/EmailProofService';
import type { AuthRoutes } from '../../../../utils/verification-evidence/authHttp';

export interface HubAuthControllerOptions {
	clientId: string;
	sessions: RequestSessionService;
	repository: SessionRepository;
	challenges: LoginChallengeService;
	google: GoogleIdentityService;
	emailProofs: EmailProofService;
	/** Native handoff and GitHub connection routes. */
	routes: AuthRoutes;
}
