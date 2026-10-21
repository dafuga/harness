import type { MapView } from '../../../../utils/explorer-ui/focusView';
import { wholeView, pad } from '../../../../utils/explorer-ui/focusView';
import {
	nodeSize,
	type HarnessLayout,
	type PlacedUnit
} from '../../../../utils/explorer-ui/harnessLayout';

const cell = { width: nodeSize.width + nodeSize.gapX, height: nodeSize.height + nodeSize.gapY };

/** Up to this many units every dependency is drawn; beyond it only those of the selection. */
const everyEdgeLimit = 60;

/**
 * The view that shows the given units large enough to read. It is never tighter than about
 * four units across, so one match keeps its surroundings; no units, or all of them, is the
 * whole map.
 */
export function focusView(layout: HarnessLayout, ids: Set<string>): MapView {
	const wanted = layout.nodes.filter((node) => ids.has(node.unit.id));
	const whole = wholeView(layout);
	if (wanted.length === 0 || wanted.length === layout.nodes.length) return whole;
	const left = Math.min(...wanted.map((node) => node.x));
	const top = Math.min(...wanted.map((node) => node.y));
	const right = Math.max(...wanted.map((node) => node.x)) + nodeSize.width;
	const bottom = Math.max(...wanted.map((node) => node.y)) + nodeSize.height;
	const width = Math.max(right - left, cell.width * 4) + pad * 2;
	const height = Math.max(bottom - top, cell.height * 4) + pad * 2;
	if (width >= whole.width && height >= whole.height) return whole;
	return { x: (left + right - width) / 2, y: (top + bottom - height) / 2, width, height };
}

/**
 * Where a search, a selection or an arrow key takes the reader. A small map is readable whole,
 * so it stays whole (null); a large one moves to a readable view of the wanted units.
 */
export function focusOn(layout: HarnessLayout, ids: Set<string>): MapView | null {
	return layout.nodes.length > everyEdgeLimit ? focusView(layout, ids) : null;
}

/** Scales the view about its centre, between two units across and one and a half maps. */
export function zoomView(view: MapView, factor: number, whole: MapView): MapView {
	const width = Math.min(whole.width * 1.5, Math.max(nodeSize.width * 2, view.width / factor));
	const height = (view.height * width) / view.width;
	return {
		x: view.x + (view.width - width) / 2,
		y: view.y + (view.height - height) / 2,
		width,
		height
	};
}

export function panView(view: MapView, dx: number, dy: number): MapView {
	return { ...view, x: view.x + dx, y: view.y + dy };
}

/** A map of hundreds of units would be all lines, so it draws only the selection's edges. */
export function drawnEdges(layout: HarnessLayout, selected: string | null): HarnessLayout['edges'] {
	if (layout.nodes.length <= everyEdgeLimit) return layout.edges;
	return layout.edges.filter((edge) => edge.from === selected || edge.to === selected);
}

const steps: Record<string, [number, number]> = {
	ArrowLeft: [-1, 0],
	ArrowRight: [1, 0],
	ArrowUp: [0, -1],
	ArrowDown: [0, 1]
};

/**
 * The unit an arrow key moves to from `from`: the nearest shown unit in that direction, in the
 * same row or column first. Undefined for any other key; `from` itself at the edge of the map.
 */
export function nextNode(
	layout: HarnessLayout,
	from: string,
	key: string,
	shown: Set<string>
): string | undefined {
	const step = steps[key];
	const origin = layout.nodes.find((node) => node.unit.id === from);
	if (!step || !origin) return undefined;
	const [dx, dy] = step;
	const ahead = (node: PlacedUnit) =>
		shown.has(node.unit.id) && (node.x - origin.x) * dx + (node.y - origin.y) * dy > 0;
	// Distance along the direction of travel counts once, sideways drift four times over.
	const cost = (node: PlacedUnit) => {
		const [along, across] = dx
			? [node.x - origin.x, node.y - origin.y]
			: [node.y - origin.y, node.x - origin.x];
		return Math.abs(along) + Math.abs(across) * 4;
	};
	const candidates = layout.nodes.filter(ahead).sort((left, right) => cost(left) - cost(right));
	return (candidates[0] ?? origin).unit.id;
}
