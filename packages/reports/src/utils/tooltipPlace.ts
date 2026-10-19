

/** The box of what a tooltip belongs to, and the sizes of the tooltip and of the screen. */
export interface TooltipMark {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface TooltipSize {
	width: number;
	height: number;
}

export { tooltipPlace } from '../components/harness/harness-verdict/tooltipPlace';
