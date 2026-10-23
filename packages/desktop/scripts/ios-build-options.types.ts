/** What one simulator build is asked to be. */
export interface IosBuildPlan {
	configuration: 'Debug' | 'Release';
	/** TEST ONLY: a Debug product prepared for the local test relay. Never a Release product. */
	fixture: boolean;
	/**
	 * TEST ONLY: the Debug product of an isolated copy of the native source whose scanner is the
	 * synthetic one. The real source is only read; never a Release product.
	 */
	scanFixture: boolean;
	/** Build the renderer and copy it into the native project first. */
	sync: boolean;
}
