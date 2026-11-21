// @harness-uid u_rrdlbnlg6j
/** Where each app is downloaded from. */
export interface HomeDownloads {
	/** The Mac archive the Hub serves once published; linked only after a HEAD confirms it. */
	mac: { path: string; mediaType: string };
	/** The verified App Store or TestFlight page of the iPhone app; null while there is none. */
	ios: string | null;
}
