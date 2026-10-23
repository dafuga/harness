export interface SourceState {
	files: string[];
	path: string;
	text: string;
	loading: boolean;
	error: string;
}

export type SourceFiles = () => Promise<string[]>;

export type SourceRead = (path: string) => Promise<string>;
