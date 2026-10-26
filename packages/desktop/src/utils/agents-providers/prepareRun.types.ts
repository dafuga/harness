import type { RecordedEvidenceService } from '../../services/RecordedEvidenceService';
import type { ProjectSessionService } from '../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { ProviderDiscoveryService } from '../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { ImageGenerator } from '../../models/agents-providers/AgentRunner.types';
import type { RunEvent } from '../../models/development-tooling/DesktopBridge.types';

export interface Preparation {
	session: ProjectSessionService;
	providers: ProviderDiscoveryService;
	generator: ImageGenerator;
	evidence?: Pick<RecordedEvidenceService, 'evidence' | 'artifact'>;
	emit: (event: RunEvent) => void;
}
