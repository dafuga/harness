import { expect, test } from 'vitest';
import { usagePreviewStyle } from '../../src/components/explorer-ui/usagePreviewStyle';

const box = (left: number, top: number, width: number, height: number) => ({
	left,
	top,
	right: left + width,
	bottom: top + height,
	width,
	height
});
function parts(link: ReturnType<typeof box>, owner?: ReturnType<typeof box>) {
	const root = {
		querySelector: () => ({ getBoundingClientRect: () => link }),
		closest: () =>
			owner ? { getBoundingClientRect: () => owner, querySelector: () => null } : null
	} as unknown as HTMLElement;
	const tip = {
		style: {} as Record<string, string>,
		scrollHeight: 100,
		offsetHeight: 100,
		clientHeight: 100
	};
	return { root, tip: tip as unknown as HTMLElement };
}
const view = { width: 1000, height: 800 };

test('a link above or below the screen has no preview to place', () => {
	const { root, tip } = parts(box(100, -50, 80, 20));
	expect(usagePreviewStyle(root, tip, view)).toBeNull();
	expect(usagePreviewStyle(parts(box(100, 900, 80, 20)).root, tip, view)).toBeNull();
});

test('a visible link gets a width within its card and the screen edge', () => {
	const { root, tip } = parts(box(120, 300, 80, 20), box(100, 250, 200, 200));
	const style = usagePreviewStyle(root, tip, view);
	expect(style).toMatch(/^left:\d+(\.\d+)?px;top:-?\d+(\.\d+)?px;width:200px/);
	expect((tip as unknown as { style: Record<string, string> }).style.width).toBe('200px');
});

test('without a card the preview is at most 280px wide', () => {
	const { root, tip } = parts(box(120, 300, 80, 20));
	expect(usagePreviewStyle(root, tip, view)).toContain('width:280px');
});
