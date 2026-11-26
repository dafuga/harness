export interface TrackerAttachmentReader {
	/** The head commit of a pull request. */
	head(repo: string, pr: number): Promise<string>;
	file(repo: string, path: string, ref: string): Promise<Buffer>;
}
