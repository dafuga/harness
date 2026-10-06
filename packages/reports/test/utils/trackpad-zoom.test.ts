import { expect, test } from 'vitest';
import { trackpadZoom } from '../../src/utils/trackpadZoom';

test('trackpad zoom consumes pinch gestures and leaves ordinary scrolling alone', () => {
	const stage = Object.assign(new EventTarget(), {
		clientHeight: 400,
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 400 })
	}) as HTMLElement;
	const applied: Array<number | null> = [];
	const action = trackpadZoom(stage, () => ({
		current: 0.5,
		minimum: 0.25,
		maximum: 4,
		apply: (next) => applied.push(next)
	}));
	const scroll = Object.assign(new Event('wheel', { cancelable: true }), {
		ctrlKey: false,
		deltaY: 120,
		deltaMode: 0,
		clientX: 100,
		clientY: 100
	});
	stage.dispatchEvent(scroll);
	expect(scroll.defaultPrevented).toBe(false);
	expect(applied).toEqual([]);
	const pinch = Object.assign(new Event('wheel', { cancelable: true }), {
		ctrlKey: true,
		deltaY: -120,
		deltaMode: 0,
		clientX: 100,
		clientY: 100
	});
	stage.dispatchEvent(pinch);
	expect(pinch.defaultPrevented).toBe(true);
	expect(applied[0]).toBeGreaterThan(0.5);
	stage.dispatchEvent(new Event('gesturestart', { cancelable: true }));
	stage.dispatchEvent(
		Object.assign(new Event('gesturechange', { cancelable: true }), { scale: 2 })
	);
	expect(applied[1]).toBe(1);
	action.destroy();
});

test('small wheel pinches accumulate from fit and return to fit', () => {
	const stage = Object.assign(new EventTarget(), {
		clientHeight: 400,
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 400 })
	}) as HTMLElement;
	const minimum = 0.09;
	let current = minimum;
	let lastApplied: number | null = null;
	const action = trackpadZoom(stage, () => ({
		current,
		minimum,
		maximum: 4,
		apply: (next) => {
			lastApplied = next;
			current = next ?? minimum;
		}
	}));
	const pinch = (deltaY: number) => {
		const event = Object.assign(new Event('wheel', { cancelable: true }), {
			ctrlKey: true,
			deltaY,
			deltaMode: 0,
			clientX: 100,
			clientY: 100
		});
		stage.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	};
	for (let index = 0; index < 18; index++) {
		const before = current;
		pinch(-2);
		expect(current).toBeGreaterThan(before);
	}
	expect(current / minimum).toBeGreaterThan(1.4);
	for (let index = 0; index < 18; index++) pinch(2);
	expect(lastApplied).toBeNull();
	pinch(-120);
	expect(current / minimum).toBeLessThan(1.66);
	action.destroy();
});

test('Safari gesture reverses immediately after pinching beyond either limit', () => {
	const stage = Object.assign(new EventTarget(), {
		clientHeight: 400,
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 400 })
	}) as HTMLElement;
	const minimum = 0.09;
	let current = minimum;
	const action = trackpadZoom(stage, () => ({
		current,
		minimum,
		maximum: 4,
		apply: (next) => (current = next ?? minimum)
	}));
	const change = (scale: number) =>
		stage.dispatchEvent(Object.assign(new Event('gesturechange', { cancelable: true }), { scale }));
	stage.dispatchEvent(new Event('gesturestart', { cancelable: true }));
	change(0.5);
	expect(current).toBe(minimum);
	change(0.51);
	expect(current).toBeGreaterThan(minimum);
	stage.dispatchEvent(new Event('gestureend'));
	current = 4;
	stage.dispatchEvent(new Event('gesturestart', { cancelable: true }));
	change(2);
	expect(current).toBe(4);
	change(1.98);
	expect(current).toBeLessThan(4);
	action.destroy();
});
