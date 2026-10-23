import type { MapView } from './focusView.types';
import { type HarnessLayout } from './harnessLayout';

export const pad = 24;

export function wholeView(layout: HarnessLayout): MapView {
	return { x: -pad, y: -pad, width: layout.width + pad * 2, height: layout.height + pad * 2 };
}

export {
	focusView,
	focusOn,
	zoomView,
	panView,
	drawnEdges,
	nextNode
} from '../../components/explorer-ui/harness-map/focusView';

export type { MapView } from './focusView.types';
