// @harness-uid u_hcdv6alnyy
export type SignInProviderId = 'chatgpt' | 'claude' | 'gemini';

export interface ProviderSignInStatus {
	provider: string;
	command: string;
	available: boolean;
}

export interface ProviderSignInSpec {
	label: string;
	command: string;
	args: readonly string[];
}

export interface ProviderSignInDeps {
	locate: (command: string) => string | null;
	launch: (executable: string, args: readonly string[]) => Promise<number>;
}
