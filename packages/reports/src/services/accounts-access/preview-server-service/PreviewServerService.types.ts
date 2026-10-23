export interface PreviewHandle {
	url: string;
	close(): Promise<void>;
}

export interface PreviewResult {
	url: string;
	reused: boolean;
}
