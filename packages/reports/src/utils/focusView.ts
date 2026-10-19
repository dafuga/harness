import { type HarnessLayout } from "./harnessLayout";

/** The part of the map that is shown, in the map's own units. */
export interface MapView {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const pad = 24;

export function wholeView(layout: HarnessLayout): MapView {
	return { x: -pad, y: -pad, width: layout.width + pad * 2, height: layout.height + pad * 2 };
}

export { focusView, focusOn, zoomView, panView, drawnEdges, nextNode } from '../components/harness/harness-map/focusView';
