// @harness-uid u_azxzrv7f6j
import type { ProcessFacts } from '../../../utils/agents-providers/agentLiveness';

export interface RosterContext {
	known: Set<string>;
	now: number;
	processOf: (pid: number) => ProcessFacts;
}
