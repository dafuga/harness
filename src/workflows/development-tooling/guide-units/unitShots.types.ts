import type { ExplorerCapture } from '../../../../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';

export interface UnitShots {
	captures: ExplorerCapture[];
	gap: string | null;
}
