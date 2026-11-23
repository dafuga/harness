import type { AgentRegistryRepository } from '../../src/services/agents-providers/agent-activity-service/AgentRegistryRepository';

export type Registration = Parameters<AgentRegistryRepository['register']>[0];

export type Beat = Parameters<AgentRegistryRepository['beat']>[1];

export type End = Parameters<AgentRegistryRepository['finish']>[1];
