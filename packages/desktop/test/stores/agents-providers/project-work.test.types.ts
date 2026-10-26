export type Snapshot = {
	queueCommit: string | null;
	features: { id: string; goal: string; tldr: string; plan: null; tasks: [] }[];
};

export type Workspace = {
	projectId: string | null;
	bridge: { projectWork?: (query: { projectId: string }) => Promise<Snapshot> } | null;
};

export type State = {
	loading: boolean;
	error: string | null;
	snapshot: Snapshot | null;
	refresh(): Promise<void>;
	listen(): () => void;
};
