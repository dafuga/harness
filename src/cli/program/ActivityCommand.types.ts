import type { AgentInput } from '../../utils/agents-providers/agentStatement';

export type Flags = AgentInput & { json?: boolean; limit?: string; failed?: boolean };
