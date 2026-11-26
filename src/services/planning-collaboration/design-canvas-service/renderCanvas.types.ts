// @harness-uid u_z3z374gyr7
import type {
	ArtboardTheme,
	CanvasBoard
} from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';

export type RenderRequest = {
	root: string;
	out: string;
	boards: readonly CanvasBoard[];
	themes: readonly ArtboardTheme[];
};
