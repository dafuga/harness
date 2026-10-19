import { Point } from '../../utils/trackpadZoom';


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
