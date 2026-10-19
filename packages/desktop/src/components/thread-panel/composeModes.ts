import type { ComposeMode } from '../../utils/composeModes';
import type { ProjectCapabilities } from '../../models/ProjectContext.types';

/** Comment leads wherever people may comment; Plan and Change need agents at a writable tip. */
export function composeModes(capabilities: ProjectCapabilities, writable: boolean): ComposeMode[] {
	const modes: ComposeMode[] = capabilities.comments ? ['comment'] : [];
	return capabilities.agents && writable ? [...modes, 'plan', 'change'] : modes;
}
