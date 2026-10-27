import type { DesktopBridge } from '../../../../../desktop/src/models/DesktopBridge.types';

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

/** A declared row that cannot be represented through the committed typed fixture seams. */
export interface ProjectAgentStateFixtureGap {
	state: ProjectAgentState;
	missingPublicSeam: string;
}

export type ProjectAgentFixtureMessage = Awaited<
	ReturnType<NonNullable<DesktopBridge['messages']>>
>[number];
export type ProjectAgentFixtureProjectMessage = Awaited<
	ReturnType<NonNullable<DesktopBridge['projectMessages']>>
>[number];
