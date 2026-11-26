import type { explorerEvidence } from '../../src/utils/explorer-ui/explorerEvidence';

export type Evidence = ReturnType<typeof explorerEvidence>;

export type Capture = Evidence['after']['captures'][number];

export type Side = Evidence['after'];
