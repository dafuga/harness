// @harness-uid u_xhvmmieda3
import type {
	CanvasPoint,
	CanvasView
} from '../../../utils/planning-collaboration/designCanvas.types';
import type { GestureTarget } from './canvasGestures.types';
import { zoomAt } from '../../../utils/planning-collaboration/fitView';

/** A press that travels less than this stays a click, so an artboard can still be selected. */
const dragAfter = 4;

/**
 * Pan with a drag, a wheel, two fingers on a trackpad or the arrow keys; zoom with a pinch, a
 * modified wheel or plus and minus.
 */
export function canvasGestures(node: HTMLElement, target: GestureTarget) {
	const stop = new AbortController();
	const { signal } = stop;
	node.addEventListener('wheel', (event) => wheel(node, event, target), {
		passive: false,
		signal
	});
	node.addEventListener('keydown', (event) => key(event, target), { signal });
	pointers(node, target, signal);
	return { destroy: () => stop.abort() };
}

function local(node: HTMLElement, event: { clientX: number; clientY: number }): CanvasPoint {
	const box = node.getBoundingClientRect();
	return { x: event.clientX - box.left, y: event.clientY - box.top };
}

function wheel(node: HTMLElement, event: WheelEvent, target: GestureTarget) {
	event.preventDefault();
	const view = target.view();
	if (event.ctrlKey || event.metaKey) {
		const delta = Math.max(-50, Math.min(50, event.deltaY));
		target.move(zoomAt(view, local(node, event), Math.exp(-delta / 100)));
	} else target.move({ ...view, x: view.x - event.deltaX, y: view.y - event.deltaY });
}

const arrows: Record<string, CanvasPoint> = {
	ArrowLeft: { x: 80, y: 0 },
	ArrowRight: { x: -80, y: 0 },
	ArrowUp: { x: 0, y: 80 },
	ArrowDown: { x: 0, y: -80 }
};

const commands: Record<string, (target: GestureTarget) => void> = {
	'+': (target) => target.zoom(1.25),
	'=': (target) => target.zoom(1.25),
	'-': (target) => target.zoom(1 / 1.25),
	'0': (target) => target.fit(),
	Escape: (target) => target.clear()
};

function key(event: KeyboardEvent, target: GestureTarget) {
	if (event.metaKey || event.ctrlKey || event.altKey) return;
	const view = target.view();
	if (Object.hasOwn(arrows, event.key)) {
		const step = arrows[event.key];
		target.move({ ...view, x: view.x + step.x, y: view.y + step.y });
	} else if (Object.hasOwn(commands, event.key)) commands[event.key](target);
	else return;
	event.preventDefault();
}

function pointers(node: HTMLElement, target: GestureTarget, signal: AbortSignal) {
	const held = new Map<number, CanvasPoint>();
	let travelled = 0;
	let dragged = false;
	const down = (event: PointerEvent) => {
		if (!held.size) travelled = 0;
		dragged = false;
		held.set(event.pointerId, local(node, event));
	};
	const drag = (event: PointerEvent) => {
		const from = held.get(event.pointerId);
		if (!from) return;
		const to = local(node, event);
		travelled += Math.hypot(to.x - from.x, to.y - from.y);
		if (!dragged && travelled < dragAfter && held.size < 2) return;
		dragged = true;
		node.setPointerCapture(event.pointerId);
		const other = [...held].find(([id]) => id !== event.pointerId)?.[1];
		target.move(dragView(target.view(), { from, to, other }));
		held.set(event.pointerId, to);
	};
	const up = (event: PointerEvent) => held.delete(event.pointerId);
	// The click that ends a drag selects nothing; a click on bare canvas clears the selection.
	const click = (event: MouseEvent) => {
		if (dragged) event.stopPropagation();
		else if (event.target === node) target.clear();
		dragged = false;
	};
	node.addEventListener('pointerdown', down, { signal });
	node.addEventListener('pointermove', drag, { signal });
	node.addEventListener('pointerup', up, { signal });
	node.addEventListener('pointercancel', up, { signal });
	node.addEventListener('click', click, { capture: true, signal });
}

/** One pointer pans by its travel; with a second held, their spread zooms about their middle. */
function dragView(
	view: CanvasView,
	{ from, to, other }: { from: CanvasPoint; to: CanvasPoint; other?: CanvasPoint }
): CanvasView {
	if (!other) return { ...view, x: view.x + to.x - from.x, y: view.y + to.y - from.y };
	const middle = (a: CanvasPoint) => ({ x: (a.x + other.x) / 2, y: (a.y + other.y) / 2 });
	const spread = (a: CanvasPoint) => Math.max(1, Math.hypot(a.x - other.x, a.y - other.y));
	const next = zoomAt(view, middle(from), spread(to) / spread(from));
	return {
		...next,
		x: next.x + middle(to).x - middle(from).x,
		y: next.y + middle(to).y - middle(from).y
	};
}
