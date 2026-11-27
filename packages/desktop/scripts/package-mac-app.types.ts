// @harness-uid u_gxxwi43nxg
/** What the packager copies into the app it assembles. */
export interface MacAppSources {
	/** The directory holding the built `main.cjs` and `preload.cjs`. */
	bundles: string;
	/** The built renderer. */
	renderer: string;
	revision: string;
}
