// @harness-uid u_wri2ddoz2t
/** A requested path that the selected commit tree does not list as a file. */
export class CommitFileNotFoundError extends Error {
	override name = 'CommitFileNotFoundError';
}
