// @harness-uid u_kg5hqd6hij
export interface RunbookSource {
	/** Repository path, shown only as the section anchor name. */
	path: string;
	markdown: string;
}

export interface RunbookCanvasState {
	canvasId: string;
	digest: string;
}

export interface RunbookCanvasPorts {
	readRunbooks(): Promise<readonly RunbookSource[]>;
	loadState(): Promise<RunbookCanvasState | undefined>;
	saveState(state: RunbookCanvasState): Promise<void>;
	create(title: string, markdown: string): Promise<string>;
	replace(canvasId: string, markdown: string): Promise<void>;
	/** Gives the listed channels read access to the canvas. */
	share(canvasId: string, channelIds: readonly string[]): Promise<void>;
}
