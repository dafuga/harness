// @harness-uid u_rrdlbnlg6j
/** Where each app is downloaded from. Null means that build is not published yet. */
export interface HomeDownloads {
	/** The desktop build hosted on the Hub, as a same-origin path such as `/downloads/Harness.dmg`. */
	mac: string | null;
	/** The App Store or TestFlight page of the iPhone app. */
	ios: string | null;
}
