import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { fixture } from './hub.service.email-proof.test';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Fixture = ReturnType<typeof fixture>;
