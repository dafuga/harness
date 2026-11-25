import type { hubArtifactCommit } from '../../src/routes/api/[...path]/hub-projection-service/hubArtifactCommit';

export type Context = Parameters<typeof hubArtifactCommit>[0];

export type History = { complete: boolean; commits: Array<{ hash: string }> };

export type Outcome = History | Error;
