import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { fixture } from './desktop.function.project-agent-actions.test';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Fixture = ReturnType<typeof fixture>;
