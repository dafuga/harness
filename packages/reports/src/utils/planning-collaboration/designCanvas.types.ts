// @harness-uid u_dscanvfmta
export type ArtboardTheme = 'light' | 'dark';
export type ArtboardSize = { width: number; height: number };
export type CanvasArtboard = { file: string; title: string; x?: number; y?: number };
export type CanvasManifest = { schemaVersion: 1; title: string; artboards: CanvasArtboard[] };
/** One artboard placed on the canvas; `problem` says why its file cannot be shown as designed. */
export type CanvasBoard = ArtboardSize & {
	file: string;
	title: string;
	x: number;
	y: number;
	html: string;
	problem: string | null;
};
export type DesignCanvasSummary = { name: string; title: string; artboards: number };
export type DesignCanvasData = { name: string; title: string; boards: CanvasBoard[] };
/** The canvases of one revision, and the one asked for. */
export type DesignCanvasPage = {
	commit: string;
	branch: string;
	branches: string[];
	canvases: DesignCanvasSummary[];
	canvas: DesignCanvasData | null;
};
export type CanvasPoint = { x: number; y: number };
export type CanvasView = CanvasPoint & { scale: number };
