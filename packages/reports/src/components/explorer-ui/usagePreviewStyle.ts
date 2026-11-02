import { tooltipPlace } from '../../utils/tooltipPlace';

const edge = 8;
const widest = 280;

/**
 * The inline style that puts a usage preview beside its link inside the card that owns it, or null
 * when the link has left the screen. It sets the preview's width first so its height can be read.
 */
export function usagePreviewStyle(
	root: HTMLElement,
	tip: HTMLElement,
	view: { width: number; height: number }
): string | null {
	const at = (root.querySelector('a') ?? root).getBoundingClientRect();
	if (at.bottom < 0 || at.top > view.height) return null;
	const owner = root.closest('.ex-page-card, .ex-function-tile') ?? root.closest('.ex-usage');
	const frame = owner?.getBoundingClientRect();
	const left = Math.max(edge, frame?.left ?? edge);
	const right = Math.min(view.width - edge, frame?.right ?? view.width - edge);
	const width = Math.min(widest, right - left);
	tip.style.width = `${width}px`;
	const whole = tip.scrollHeight + tip.offsetHeight - tip.clientHeight;
	const spot = tooltipPlace(at, { width, height: whole }, view);
	spot.left = Math.max(left, Math.min(spot.left, right - width));
	const title = owner?.querySelector('h2')?.getBoundingClientRect();
	if (title && frame) {
		const above = title.top - frame.top - edge;
		const below = frame.bottom - title.bottom - edge;
		spot.height = Math.min(whole, Math.max(0, above, below));
		spot.top = above >= below ? title.top - spot.height - edge : title.bottom + edge;
	}
	const cut = spot.height === undefined ? '' : `;max-height:${spot.height}px`;
	return `left:${spot.left}px;top:${spot.top}px;width:${width}px${cut}`;
}
