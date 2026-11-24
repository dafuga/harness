import type { RequestSessionService } from '../../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';

export type DeployApprovalDependencies = {
	owner?: string;
	runnerGrants?: string;
	sessions: Pick<RequestSessionService, 'resolve'> | null;
	db?: D1Database;
	now: number;
};
