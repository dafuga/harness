// @harness-uid u_rptchqt5ts
import type { ZoomPoint } from '../../../utils/shared-primitives/trackpadZoom.types';

export function imageAnchor(image: HTMLImageElement, pointer: ZoomPoint): ZoomPoint {
	const rect = image.getBoundingClientRect();
	return {
		x: Math.max(0, Math.min(1, (pointer.x - rect.left) / rect.width)),
		y: Math.max(0, Math.min(1, (pointer.y - rect.top) / rect.height))
	};
}

export function keepPointerInPlace(
	viewport: HTMLElement,
	image: HTMLImageElement,
	anchor: ZoomPoint,
	pointer: ZoomPoint
) {
	const rect = image.getBoundingClientRect();
	viewport.scrollLeft += rect.left + anchor.x * rect.width - pointer.x;
	viewport.scrollTop += rect.top + anchor.y * rect.height - pointer.y;
}
