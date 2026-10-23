export interface ProductChange {
	/**
	 * Plain http to this machine is let through by the system. A Debug fixture copy needs it to
	 * reach the local test relay; a Release copy gets it to show that it still refuses by itself.
	 */
	localNetworking: boolean;
	/** WebKit's inspector may attach, so that a check can read the page. */
	inspection: boolean;
}
