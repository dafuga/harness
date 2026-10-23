/**
 * What a project has been doing, read from the project itself: the loop types it uses, its
 * commits with the reasons noted on them, the files that changed with the components that own
 * them, and, apart from all that, what is changed in a checkout and not committed.
 */
export interface Change {
	path: string;
	status: string;
	units: string[];
}

export interface Shown {
	activity: {
		kind: string;
		repository: { name: string; branch: string | null; head: string | null };
		loops: {
			total: number;
			types: Array<{
				template: string;
				loops: number;
				complete: number;
				open: number;
				names: string[];
			}>;
		};
		work: Array<{
			commit: string;
			subject: string;
			committedAt: string;
			branches: string[];
			units: string[];
			reasons: Array<{ unit: string; behavior: string }>;
			reasonCount: number;
		}>;
		files: Array<Change & { commit: string; committedAt: string }>;
	};
	live: {
		worktrees: Array<{
			name: string;
			branch: string | null;
			primary: boolean;
			changes: Change[];
			truncated: boolean;
		}>;
		agents: {
			tracking: string;
			working: number | null;
			roster: Array<{ label: string; worktree: string; units: string[]; unknownUnits: string[] }>;
		};
	};
}
