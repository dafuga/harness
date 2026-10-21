import { closedCapabilities } from '../projectCapabilities';
import type { DesktopBridge } from '../../../models/development-tooling/DesktopBridge.types';
import type { ProjectSnapshot } from '../../../models/development-tooling/Desktop.types';
import type { ProjectCapabilities } from '../../../models/projects-sessions/ProjectContext.types';

/** A bridge from before capabilities has its required agent operations and nothing newer. */
function legacyCapabilities(): ProjectCapabilities {
	return { ...closedCapabilities, agents: true, planning: true, approval: true };
}

async function stated(bridge: DesktopBridge, snapshot: ProjectSnapshot) {
	if (snapshot.capabilities) return snapshot.capabilities;
	if (!bridge.capabilities) return legacyCapabilities();
	const id = snapshot.project.id;
	try {
		return await bridge.capabilities(id ? { projectId: id } : {});
	} catch {
		return { ...closedCapabilities, reason: 'This project did not report what it allows.' };
	}
}

/** The capabilities of the shown project; commenting also needs the bridge's comment operation. */
export async function projectCapabilities(
	bridge: DesktopBridge,
	snapshot: ProjectSnapshot
): Promise<ProjectCapabilities> {
	const value = await stated(bridge, snapshot);
	return { ...value, comments: value.comments && typeof bridge.addComment === 'function' };
}
