// @harness-uid u_geopxvz5u4

/** Facts a host preflight collects about the agent's OS user and the browser executor. */
export interface VaultHostProbe {
	host: string;
	isolation: 'os-user' | 'vm' | 'none';
	sharedSudoHost: boolean;
	agent: {
		uid: number;
		groups: string[];
		sudo: boolean;
		dockerSocket: boolean;
		executorHomeWritable: boolean;
	};
	executor: { uid: number } | null;
	chromiumSandbox: boolean;
}

export type VaultHostVerdict =
	| { eligible: true; host: string; isolation: 'os-user' | 'vm' }
	| { eligible: false; host: string; reasons: string[] };
