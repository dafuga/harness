export type PublishOptions = {
	commit: string;
	artifact: string;
	profile: string;
	approve?: string;
};

export type RunMode = 'inspect' | 'publish' | 'tool' | 'scaffold';

export type RunProfile = {
	sdk: boolean;
	timeoutMs: number;
	failure: string;
	stopped: string;
};

export type RunHarborSdkTool = (args: string[], mode: 'tool' | 'scaffold') => Promise<void>;

export interface ScaffoldOptions {
	mobile?: boolean;
}
