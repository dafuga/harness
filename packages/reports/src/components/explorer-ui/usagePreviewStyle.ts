// @harness-uid u_2ldh4ufj6z
import { tooltipPlace } from '../../utils/explorer-ui/tooltipPlace';

const edge = 8;
const widest = 280;
type Place = ReturnType<typeof tooltipPlace>;

/** The room the owning card, or else the screen, leaves a preview from side to side. */
function room(frame: DOMRect | undefined, screen: number): { left: number; right: number } {
	return {
		left: Math.max(edge, frame?.left ?? edge),
		right: Math.min(screen - edge, frame?.right ?? screen - edge)
	};
}

/** Keeps a preview within its card's height by putting it above or below the card's title. */
function besideTitle(spot: Place, whole: number, owner: Element | null, frame?: DOMRect): void {
	const title = owner?.querySelector('h2')?.getBoundingClientRect();
	if (!title || !frame) return;
	const above = title.top - frame.top - edge;
	const below = frame.bottom - title.bottom - edge;
	spot.height = Math.min(whole, Math.max(0, above, below));
	spot.top = above >= below ? title.top - spot.height - edge : title.bottom + edge;
}

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
	const { left, right } = room(frame, view.width);
	const width = Math.min(widest, right - left);
	tip.style.width = `${width}px`;
	const whole = tip.scrollHeight + tip.offsetHeight - tip.clientHeight;
	const spot = tooltipPlace(at, { width, height: whole }, view);
	spot.left = Math.max(left, Math.min(spot.left, right - width));
	besideTitle(spot, whole, owner, frame);
	const cut = spot.height === undefined ? '' : `;max-height:${spot.height}px`;
	return `left:${spot.left}px;top:${spot.top}px;width:${width}px${cut}`;
}
