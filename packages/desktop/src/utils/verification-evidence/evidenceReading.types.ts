import type { ExplorerBehavior } from '../../../../reports/src/models/Explorer.types';

export interface EvidenceRead {
	/** The behaviour with every recorded result read, checked and compared. */
	behavior: ExplorerBehavior;
	/** Why the backend gave no bytes for a result, by the hash of that result, in its words. */
	refusals: Record<string, string>;
}
