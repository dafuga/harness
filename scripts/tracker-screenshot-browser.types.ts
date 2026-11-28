// @harness-uid u_auvse3vf4t
export interface ScreenshotBrowser {
	screenshot(): Promise<Buffer>;
	click(x: number, y: number): Promise<void>;
	type(text: string): Promise<void>;
	close(): Promise<void>;
}

export interface ScreenshotBrowserReply {
	id?: number;
	error?: unknown;
	result?: { data?: string; errorText?: string };
}
