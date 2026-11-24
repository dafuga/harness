import type { RequestSessionService } from '../../../../lib/verification-evidence/server/auth/request-session-service/RequestSessionService';

import type { DeployApprovalRepository } from '../../../../repositories/accounts-access/DeployApprovalRepository';

export type DeployApprovalDependencies = {
	owner?: string;
	runnerGrants?: string;
	sessions: Pick<RequestSessionService, 'resolve'> | null;
	db?: D1Database;
	now: number;
};

export type DeployApprovalContext = {
	owner: string;
	now: number;
	repository: DeployApprovalRepository;
};
