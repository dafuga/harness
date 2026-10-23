/**
 * The search of the top bar at every supported width. Closed, focused or with its results open,
 * the field and its focus ring meet neither revision field, which keep the widths they have at that
 * width without the search, the results cover neither, and no page is wider than the screen. A
 * result opens in place, and with a modifier in another tab. A screenshot is kept when
 * TAKE_SCREENSHOT=true.
 */
export type Box = { x: number; y: number; width: number; height: number };
