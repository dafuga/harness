// @harness-uid u_gegtad6hae
import type { DesktopProject } from '../../../../models/projects-sessions/ProjectContext.types';
import type { CacheIdentity } from '../../../../../../collaboration/src/models/planning-collaboration/Collaboration.types';
import type { ProjectSnapshot } from '../../../../models/development-tooling/Desktop.types';

/** What this device kept of a principal's last current list, and the identity it is bound to. */
export interface HeldDiscovery {
	projects: DesktopProject[];
	identity: CacheIdentity;
}

/** Reads a project's tip once, which keeps it for when the hub is away. */
export interface SnapshotPort {
	snapshot(input: { projectId: string; branch: null; commit: null }): Promise<ProjectSnapshot>;
}

/** A discovery with no hosted credential at its start, or whose credential changed while it ran. */
export class HostedAuthorityChangedError extends Error {
	override name = 'HostedAuthorityChangedError';
}
