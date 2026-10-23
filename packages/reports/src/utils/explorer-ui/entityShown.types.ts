import type { ContractRow } from './entityContract';
import type { EntityMeasure } from './entityMeasure';
import type { HarnessRecord } from '../../models/explorer-ui/Harness.types';
import type { ExplorerScreenProps } from '../../models/explorer-ui/ExplorerScreen.types';

export interface EntityShown {
	contract: ContractRow[];
	measure: EntityMeasure;
	/** Full-verification verdict only; focused observations retain their original revision separately. */
	record: HarnessRecord | null;
}

export type Shown = Pick<ExplorerScreenProps, 'head' | 'parent'>;
