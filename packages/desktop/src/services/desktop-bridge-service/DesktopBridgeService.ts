import { HostedProjectService } from './HostedProjectService';
import type { ProjectSessionService } from '../project-session-service/ProjectSessionService';
import type { ProviderDiscoveryService } from '../provider-discovery-service/ProviderDiscoveryService';
import type { DesktopRunService } from '../desktop-run-service/DesktopRunService';
import { desktopBridge } from '../../lib/desktop-bridge/desktopBridge';
export class DesktopBridgeService {
	constructor(
		private session: ProjectSessionService,
		private providers: ProviderDiscoveryService,
		private runs: DesktopRunService,
		private choose: () => Promise<string | null>
	) {}
	bridge() {
		const local = desktopBridge({
			session: this.session,
			providers: this.providers,
			runs: this.runs,
			choose: this.choose
		});
		return this.session.remote
			? new HostedProjectService(this.session, this.session.remote).wrap(local)
			: local;
	}
}
