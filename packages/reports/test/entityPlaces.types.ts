import type { ExplorerScope } from '../src/models/explorer-ui/Explorer.types';
import type { HarnessRevision } from '../src/models/Harness.types';

export interface View {
	scope: ExplorerScope;
	head: HarnessRevision;
	parent: HarnessRevision | null;
}
