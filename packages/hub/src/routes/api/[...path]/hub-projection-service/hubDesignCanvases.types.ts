// @harness-uid u_6ge2cfqn3l
import type {
	Actor,
	CollaborationCache,
	ProjectSummary,
	SourceHistoryAdapter
} from 'collaboration';

export type DesignCanvasQuery = {
	branch: string | null;
	commit: string | null;
	canvas: string | null;
};
export type Input = {
	actor: Actor;
	source: SourceHistoryAdapter;
	cache: CollaborationCache;
	project: ProjectSummary;
};
