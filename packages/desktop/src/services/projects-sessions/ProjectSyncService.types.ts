/** What one surface reads again to stay current, and how often while it is shown. */
export interface ProjectSyncOptions {
	/** One read of who is signed in and of their projects; it reports its own failures. */
	refresh: () => Promise<unknown>;
	/** Milliseconds between reads while the surface is shown; half a minute by default. */
	interval?: number;
}
