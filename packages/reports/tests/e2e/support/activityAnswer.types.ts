/** The answer of the activity API, as far as the specs of the removed analytics page read it. */
export interface ActivityAnswer {
	activity: {
		kind: string;
		repository: { name: string; branch: string; head: string };
		loops: {
			total: number;
			types: Array<{ template: string; loops: number; complete: number; open: number }>;
		};
		work: Array<{
			commit: string;
			subject: string;
			units: string[];
			unitCount: number;
			reasons: Array<{ unit: string; behavior: string }>;
			reasonCount: number;
			files: number;
		}>;
		files: Array<{ path: string; status: string; units: string[] }>;
	};
	live: {
		sampledAt: string;
		worktrees: Array<{
			name: string;
			branch: string;
			truncated: boolean;
			changes: Array<{ path: string; status: string; units: string[] }>;
		}>;
		agents: {
			tracking: string;
			working: number | null;
			roster: Array<{
				label: string;
				state: string;
				detail: string;
				/** How a finished agent said it ended. */
				outcome?: string;
				provider?: string;
				model?: string;
				worktree?: string;
				branch?: string;
				task?: string;
				units: string[];
				heartbeatAt: string;
				expiresAt: string;
			}>;
		};
	};
}
