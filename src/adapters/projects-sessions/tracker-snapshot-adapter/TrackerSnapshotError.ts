// @harness-uid u_earfvkmyr2
/** A snapshot could not be safely fingerprinted. Messages omit paths, SQLite diagnostics, and rows. */
export class TrackerSnapshotError extends Error {
	constructor(message: string = 'Unable to read SQLite snapshot') {
		super(message);
		this.name = 'TrackerSnapshotError';
	}
}
