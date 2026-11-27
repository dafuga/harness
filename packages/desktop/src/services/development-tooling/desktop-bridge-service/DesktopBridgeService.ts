// @harness-uid u_ci4df7hlmv
import { HostedProjectService } from './HostedProjectService';
import type { ProjectSessionService } from '../../projects-sessions/project-session-service/ProjectSessionService';
import type { ProviderDiscoveryService } from '../../agents-providers/provider-discovery-service/ProviderDiscoveryService';
import type { DesktopRunService } from '../../agents-providers/desktop-run-service/DesktopRunService';
import { desktopBridge } from '../../../lib/development-tooling/desktop-bridge/desktopBridge';
import type { CacheStatus } from '../../../models/projects-sessions/ProjectContext.types';
export class DesktopBridgeService {
	constructor(
		private session: ProjectSessionService,
		private providers: ProviderDiscoveryService,
		private runs: DesktopRunService,
		private choose: () => Promise<string | null>
	) {}
	bridge(onCacheStatus?: (event: CacheStatus) => void) {
		const local = desktopBridge({
			session: this.session,
			providers: this.providers,
			runs: this.runs,
			choose: this.choose
		});
		return this.session.remote
			? new HostedProjectService(this.session, this.session.remote, onCacheStatus).wrap(local)
			: local;
	}
}
