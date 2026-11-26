// @harness-uid u_n2az4s5ol5
export type TrackerHostKind = 'systemd' | 'shell' | 'launchd';

export interface TrackerHostInstallInput {
	/** The stable Harness launcher the host manager runs. */
	executable: string;
	config: string;
	role: 'hub' | 'spoke';
	/** The node's database, beside which the supervisor keeps its lock and log. */
	database: string;
	home: string;
	uid: number;
}

export interface TrackerHostCommandResult {
	status: number | null;
	stdout: string;
}

export interface TrackerHostInstallPorts {
	run(command: string, args: string[]): TrackerHostCommandResult;
	/** Start a detached process that outlives this one. */
	start(command: string[]): void;
}

export interface TrackerHostFile {
	path: string;
	content: string;
}
