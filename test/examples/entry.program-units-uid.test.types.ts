export type Action = (...args: unknown[]) => unknown;

export interface FakeSub {
	option(flag: string): FakeSub;
	description(text: string): FakeSub;
	action(handler: Action): FakeSub;
}

export interface Registered {
	name: string;
	options: string[];
	description?: string;
	action?: Action;
}
