// @harness-uid u_25nqchdxgq
import type { EntityDetail, ThreadInfo } from '../../../models/development-tooling/Desktop.types';
import type { Workspace } from '../../../lib/stores/projects-sessions/workspace.svelte';
import type { ThreadTarget } from '../../../utils/explorer-ui/threadAnchor';

export interface ThreadPanelProps {
	entity: EntityDetail;
	workspace: Workspace;
	thread?: ThreadInfo | null;
	/** A region or image that was selected where no thread is opened for it yet. */
	target?: ThreadTarget | null;
	version?: string;
	/** The design option in view; empty for a design without options. */
	option?: string;
	close: () => void;
}
