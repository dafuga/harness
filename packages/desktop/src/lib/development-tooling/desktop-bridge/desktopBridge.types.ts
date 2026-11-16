// @harness-uid u_n566twzfi3
import type { ProjectSessionService } from '../../../services/projects-sessions/project-session-service/ProjectSessionService';
import type { ProviderDiscoveryService } from '../../../services/agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { DesktopRunService } from '../../../services/agents-providers/desktop-run-service/DesktopRunService';

export class PlanningArtifactsBusyError extends Error {
	override name = 'PlanningArtifactsBusyError';
}

export class DesktopSessionEndedError extends Error {
	override name = 'DesktopSessionEndedError';
}

export class RepositoryLeaseUnavailableError extends Error {
	override name = 'RepositoryLeaseUnavailableError';
}

export class UnknownEntityError extends Error {
	override name = 'UnknownEntityError';
}

export class DraftSourceNotRegisteredError extends Error {
	override name = 'DraftSourceNotRegisteredError';
}

export class HostedSignInNotConfiguredError extends Error {
	override name = 'HostedSignInNotConfiguredError';
}

export interface BridgeContext {
	session: ProjectSessionService;
	providers: ProviderDiscoveryService;
	runs: DesktopRunService;
	choose: () => Promise<string | null>;
	/** False once the client this bridge serves has ended: nothing more is written for it. */
	alive?: () => boolean;
}
