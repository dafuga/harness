/** A process owns the preview slot until it exits; this endpoint can only read its status. */
export interface PreviewOwner {
	protocol: 'harness-preview-v1';
	identity: string;
	url: string | null;
	pid: number;
}
