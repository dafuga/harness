import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { ProviderDiscoveryService } from '../../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { DesktopRunService } from '../../../services/agents-providers/desktop-run-service/DesktopRunService';

export interface BridgeContext {
	session: ProjectSessionService;
	providers: ProviderDiscoveryService;
	runs: DesktopRunService;
	choose: () => Promise<string | null>;
	/** False once the client this bridge serves has ended: nothing more is written for it. */
	alive?: () => boolean;
}
