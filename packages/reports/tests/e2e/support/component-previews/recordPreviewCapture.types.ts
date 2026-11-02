export interface PreviewCaptureRecord {
	id: string;
	variant: string;
	viewport: string;
	clip: { x: number; y: number; width: number; height: number };
	bytes: Buffer;
	reportDialog: boolean;
}
