// @harness-uid u_sjbkerzshs
import type { EntityEvidenceQuery } from '../../../models/verification-evidence/DesktopEvidence.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';

export type Shown = Pick<EntityEvidenceQuery, 'branch' | 'commit'>;

export class RegisteredProjectIdRequiredError extends Error {
	override name = 'RegisteredProjectIdRequiredError';
}

export class LocalBranchRequiredError extends Error {
	override name = 'LocalBranchRequiredError';
}

export type ProjectRead = Pick<
	ReturnType<ProjectSessionService['requireProject']>,
	'root' | 'source'
> & {
	projectId: string;
};
