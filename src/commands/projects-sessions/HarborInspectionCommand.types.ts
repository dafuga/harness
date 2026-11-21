// @harness-uid u_yga4vj5ueo
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

export type ScaffoldArguments = [
	template: string,
	dir: string,
	id: string | undefined,
	name: string | undefined,
	options: { mobile?: boolean }
];
