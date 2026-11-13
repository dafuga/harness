// @harness-uid u_4pduzolhj3
export interface ForwardEntry {
	path: string;
	target: string;
	uid: string;
	status: string;
}

export interface ForwardRegistry {
	schemaVersion?: number;
	forwards?: ForwardEntry[];
}

export interface ForwardResolutionContext {
	root: string;
	canonicalTargets: Set<string>;
	forwardPaths: Set<string>;
}

export interface ForwardCheckContext {
	root: string;
	registered: Map<string, ForwardEntry>;
	resolution: ForwardResolutionContext;
}

export interface ExportResolution {
	targets: Set<string>;
	cycles: string[][];
}
