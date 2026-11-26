import type { ProjectDiscoveryService } from '../../src/lib/development-tooling/desktop-initialization/remote-http-project-adapter/ProjectDiscoveryService';

export type Ports = ConstructorParameters<typeof ProjectDiscoveryService>;

export interface Fixture {
	list: unknown[];
	offline?: boolean;
	credentials?: () => Promise<unknown>;
}
