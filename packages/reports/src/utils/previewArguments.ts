

export interface PreviewArguments {
	root: string;
	configFile?: string;
	port: number;
	identity: string;
}

export { previewArguments } from './preview-node/previewArguments';
