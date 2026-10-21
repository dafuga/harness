import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';

export interface PlacedUnit {
	unit: HarnessUnit;
	x: number;
	y: number;
}

export interface HarnessLayout {
	nodes: PlacedUnit[];
	edges: Array<{ from: string; to: string; x1: number; y1: number; x2: number; y2: number }>;
	width: number;
	height: number;
}

export const nodeSize = { width: 176, height: 34, gapX: 16, gapY: 46 };

export {
	mapColumns,
	harnessLayout
} from '../../components/explorer-ui/harness/harness-map/harnessLayout';
