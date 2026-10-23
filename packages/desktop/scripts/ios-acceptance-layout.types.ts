/** What the page measures of itself: the safe area, the strip that covers it, the status bar. */
export interface Measured {
	inset: number;
	scrolled: number;
	strip: { fixed: boolean; top: number; height: number; opaque: boolean; above: number };
	/** Elements of the page that lie in the top safe area, at three places across it. */
	beneath: number;
	facts: number;
	stacked: boolean;
	aligned: boolean;
	fits: boolean;
}
