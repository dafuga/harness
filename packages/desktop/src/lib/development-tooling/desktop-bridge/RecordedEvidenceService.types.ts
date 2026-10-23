import type { EntityEvidenceQuery } from '../../../models/verification-evidence/DesktopEvidence.types';
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';

export type Shown = Pick<EntityEvidenceQuery, 'branch' | 'commit'>;

export type ProjectRead = Pick<
	ReturnType<ProjectSessionService['requireProject']>,
	'root' | 'source'
> & {
	projectId: string;
};
