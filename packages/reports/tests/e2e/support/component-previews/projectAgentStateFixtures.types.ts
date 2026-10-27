/** Orchestrator-declared standard ProjectAgent fixture states. */
export type ProjectAgentState =
	| 'rest'
	| 'closed'
	| 'read-only'
	| 'local-comment'
	| 'hosted-comment'
	| 'comment-retry'
	| 'conversation'
	| 'historical'
	| 'ask'
	| 'plan'
	| 'visual-plan'
	| 'change'
	| 'no-provider'
	| 'running'
	| 'saved-plan'
	| 'failure'
	| 'agents-empty'
	| 'agents-active'
	| 'agents-unknown'
	| 'agents-stale'
	| 'agents-many';

/** Exact state selected by the standard component catalog case. */
export interface ProjectAgentStateFixtureOptions {
	state: ProjectAgentState;
}
