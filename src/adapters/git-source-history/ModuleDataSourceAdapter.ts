import { CommitTreeAdapter } from './CommitTreeAdapter';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
/** Exact Git reads used by historical metadata production. */
export class ModuleDataSourceAdapter {
	static async open(root: string, revision: string): Promise<SourceTree> {
		return CommitTreeAdapter.open(root, revision);
	}
}
