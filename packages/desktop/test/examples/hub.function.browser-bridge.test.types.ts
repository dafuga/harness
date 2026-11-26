import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { browserBridge } from '../../src/adapters/explorer-ui/browser-project-adapter/browserBridge';

export type Replies = Record<string, unknown>;

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Bridge = Required<ReturnType<typeof browserBridge>>;
