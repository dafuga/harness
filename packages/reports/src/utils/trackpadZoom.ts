export type Point = { x: number; y: number };
type ZoomControls = {
	current: number;
	minimum: number;
	maximum: number;
	apply: (next: number | null, point: Point) => void;
};
type Gesture = Event & { scale?: number; clientX?: number; clientY?: number };
// Chrome sends a pinch as Ctrl+wheel with deltaY = -100·ln(scale), so zoom follows the fingers;
// the cap keeps one Ctrl+mouse-wheel notch to about 1.65×.
const PINCH_DELTA = 100;
const MAX_WHEEL_DELTA = 50;
// Only rounding noise counts as fit, so the smallest outward pinch leaves the fitted view.
const FIT_TOLERANCE = 1e-9;

export function imageAnchor(image: HTMLImageElement, pointer: Point): Point {
	const rect = image.getBoundingClientRect();
	return {
		x: Math.max(0, Math.min(1, (pointer.x - rect.left) / rect.width)),
		y: Math.max(0, Math.min(1, (pointer.y - rect.top) / rect.height))
	};
}

export function keepPointerInPlace(
	viewport: HTMLElement,
	image: HTMLImageElement,
	anchor: Point,
	pointer: Point
) {
	const rect = image.getBoundingClientRect();
	viewport.scrollLeft += rect.left + anchor.x * rect.width - pointer.x;
	viewport.scrollTop += rect.top + anchor.y * rect.height - pointer.y;
}

function wheelFactor(event: WheelEvent, pageHeight: number) {
	const unit = [1, 16, pageHeight][event.deltaMode] ?? 1;
	const delta = Math.max(-MAX_WHEEL_DELTA, Math.min(MAX_WHEEL_DELTA, event.deltaY * unit));
	return Math.exp(-delta / PINCH_DELTA);
}

export function trackpadZoom(node: HTMLElement, controls: () => ZoomControls | null) {
	let gestureScale = 1;
	let gestureActive = false;
	const point = (event: Gesture): Point => {
		const rect = node.getBoundingClientRect();
		return {
			x: event.clientX ?? rect.left + rect.width / 2,
			y: event.clientY ?? rect.top + rect.height / 2
		};
	};
	// Scale what is on screen now, so reversing at fit or the maximum responds at once.
	const zoomBy = (factor: number, event: Gesture) => {
		const zoom = controls();
		if (!zoom) return;
		const next = Math.max(zoom.minimum, Math.min(zoom.maximum, zoom.current * factor));
		zoom.apply(next <= zoom.minimum * (1 + FIT_TOLERANCE) ? null : next, point(event));
	};
	const wheel = (event: WheelEvent) => {
		if (!event.ctrlKey) return;
		event.preventDefault();
		if (!gestureActive) zoomBy(wheelFactor(event, node.clientHeight), event);
	};
	const start = (event: Event) => {
		event.preventDefault();
		gestureScale = 1;
		gestureActive = true;
	};
	// Safari reports scale since gesturestart; apply only the change since the previous event.
	const change = (event: Event) => {
		event.preventDefault();
		const scale = (event as Gesture).scale || gestureScale;
		zoomBy(scale / gestureScale, event as Gesture);
		gestureScale = scale;
	};
	const end = () => {
		gestureActive = false;
	};
	node.addEventListener('wheel', wheel, { passive: false });
	node.addEventListener('gesturestart', start, { passive: false });
	node.addEventListener('gesturechange', change, { passive: false });
	node.addEventListener('gestureend', end);
	return {
		destroy() {
			node.removeEventListener('wheel', wheel);
			node.removeEventListener('gesturestart', start);
			node.removeEventListener('gesturechange', change);
			node.removeEventListener('gestureend', end);
		}
	};
}
