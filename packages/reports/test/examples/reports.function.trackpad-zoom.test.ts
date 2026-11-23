import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	imageAnchor,
	keepPointerInPlace
} from '../../src/components/shared-primitives/image-zoom/trackpadZoom';
import { trackpadZoom } from '../../src/utils/shared-primitives/trackpadZoom';
import type { Point, ZoomControls } from '../../src/utils/shared-primitives/trackpadZoom.types';

function checkZoom(): {
	prevented: boolean;
	applied: { next: number | null; point: Point };
	listenersAfterDestroy: number;
} {
	const listeners = new Map<string, EventListener>();
	const node = {
		clientHeight: 600,
		getBoundingClientRect: () => ({ left: 10, top: 20, width: 300, height: 200 }),
		addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
		removeEventListener: (type: string) => listeners.delete(type)
	} as unknown as HTMLElement;
	const applied: Array<{ next: number | null; point: Point }> = [];
	const controls: ZoomControls = {
		current: 2,
		minimum: 1,
		maximum: 3,
		apply: (next, point) => applied.push({ next, point })
	};
	const teardown = trackpadZoom(node, () => controls);
	const wheel = Object.assign(new Event('wheel', { cancelable: true }), {
		ctrlKey: true,
		deltaY: -100,
		deltaMode: 0,
		clientX: 120,
		clientY: 80
	}) as WheelEvent;
	listeners.get('wheel')?.(wheel);
	expect(wheel.defaultPrevented).toBe(true);
	expect(applied[0]).toEqual({ next: 3, point: { x: 120, y: 80 } });
	const plainWheel = Object.assign(new Event('wheel', { cancelable: true }), {
		ctrlKey: false,
		deltaY: 20,
		deltaMode: 0
	}) as WheelEvent;
	listeners.get('wheel')?.(plainWheel);
	expect(plainWheel.defaultPrevented).toBe(false);
	teardown.destroy();
	expect(listeners.size).toBe(0);
	return {
		prevented: wheel.defaultPrevented,
		applied: applied[0],
		listenersAfterDestroy: listeners.size
	};
}

test('Keeps pointer anchors and bounds trackpad zoom', () => {
	const imageRect = { left: 100, top: 50, width: 400, height: 200 };
	const image = { getBoundingClientRect: () => imageRect } as HTMLImageElement;
	const anchored = imageAnchor(image, { x: 268, y: 172 });
	expect(anchored).toEqual({ x: 0.42, y: 0.61 });

	const viewport = { scrollLeft: 20, scrollTop: 30 } as HTMLElement;
	keepPointerInPlace(viewport, image, { x: 0.25, y: 0.5 }, { x: 180, y: 100 });
	expect({ left: viewport.scrollLeft, top: viewport.scrollTop }).toEqual({ left: 40, top: 80 });
	const zoom = checkZoom();

	const state = 'keeps-pointer-anchors-and-bounds-trackpad-zoom';
	recordExampleCases(
		{
			unitId: 'reports.function.trackpad-zoom',
			symbol: 'trackpadZoom',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'normalizes a pointer within the image',
				input: { rect: imageRect, pointer: { x: 268, y: 172 } },
				output: anchored
			},
			{
				name: 'adjusts viewport scroll to keep the selected point under the pointer',
				input: {
					scroll: { left: 20, top: 30 },
					rect: imageRect,
					anchor: { x: 0.25, y: 0.5 },
					pointer: { x: 180, y: 100 }
				},
				output: { left: viewport.scrollLeft, top: viewport.scrollTop }
			},
			{
				name: 'clamps Ctrl-wheel zoom at the maximum and removes listeners on destroy',
				input: { current: 2, minimum: 1, maximum: 3, deltaY: -100, point: { x: 120, y: 80 } },
				output: zoom
			}
		]
	);
});
