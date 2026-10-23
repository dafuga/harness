export interface PreviewArguments {
	root: string;
	configFile?: string;
	port: number;
	identity: string;
}

export type PreviewOptions = { root: string; configFile?: string; port: number };
