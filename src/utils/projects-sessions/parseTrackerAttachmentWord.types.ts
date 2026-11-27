// @harness-uid u_2c64lq6rce
/** A file in a GitHub repository, named by a pull request, a commit or both. */
export interface TrackerAttachmentSource {
	repo: string;
	path: string;
	pr?: number;
	ref?: string;
}
