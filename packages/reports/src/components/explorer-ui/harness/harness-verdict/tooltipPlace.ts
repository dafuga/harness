import type { TooltipMark, TooltipSize } from '../../../../utils/explorer-ui/tooltipPlace';

/** The space kept between a tooltip and its mark, and between a tooltip and the screen's edge. */
const gap = 8;

/**
 * Where a tooltip goes on the screen: under its mark and centred on it, moved sideways until it
 * is wholly on the screen, and above the mark when only there it has room. One taller than the
 * room on either side takes the larger side and the height of it, and is read by scrolling.
 */
export function tooltipPlace(
	mark: TooltipMark,
	tip: TooltipSize,
	view: TooltipSize
): { left: number; top: number; height?: number } {
	const centred = mark.left + mark.width / 2 - tip.width / 2;
	const left = Math.max(gap, Math.min(centred, view.width - tip.width - gap));
	const under = mark.top + mark.height + gap;
	const room = { under: view.height - gap - under, above: mark.top - 2 * gap };
	if (tip.height <= room.under) return { left, top: under };
	if (tip.height <= room.above) return { left, top: mark.top - gap - tip.height };
	return room.under >= room.above
		? { left, top: under, height: room.under }
		: { left, top: gap, height: room.above };
}
