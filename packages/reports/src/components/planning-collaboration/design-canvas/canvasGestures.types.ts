// @harness-uid u_xhvmmieda3
import type { CanvasView } from '../../../utils/planning-collaboration/designCanvas.types';

export type GestureTarget = {
	view: () => CanvasView;
	move: (view: CanvasView) => void;
	zoom: (factor: number) => void;
	fit: () => void;
	clear: () => void;
};
