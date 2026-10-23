import type { ExplorerScope } from '../src/models/Explorer.types';
import type { HarnessRevision } from '../src/models/Harness.types';

export interface View {
	scope: ExplorerScope;
	head: HarnessRevision;
	parent: HarnessRevision | null;
}
