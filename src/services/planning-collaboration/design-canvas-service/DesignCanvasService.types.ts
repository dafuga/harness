// @harness-uid u_dscanvsvca
import type {
	ArtboardSize,
	CanvasPoint
} from '../../../../packages/reports/src/utils/planning-collaboration/designCanvas.types';

/** What `add` and `update` may change about one artboard. */
export type ArtboardChange = {
	title?: string;
	html?: string;
	size?: ArtboardSize;
	/** 1-based place in the canvas order. */
	order?: number;
	/** A hand-placed position, or null to return the board to the row. */
	position?: CanvasPoint | null;
};
