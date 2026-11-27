// @harness-uid u_d22gcywhzl
export type ContainerBrowserAction =
	| 'setup'
	| 'up'
	| 'status'
	| 'down'
	| 'open'
	| 'viewer'
	| 'approve'
	| 'revoke';

export interface ContainerBrowserRunInput {
	action: ContainerBrowserAction;
	profile: string;
	/** The pairing code for approve, or the address for open. */
	value?: string;
	port: number;
	host?: string[];
	accessHost?: string;
	accessTeam?: string;
	accessAudience?: string;
	accessEmail?: string;
	diskImage?: string;
	downloadKbps: number;
	directory?: string;
	signal?: AbortSignal;
}
