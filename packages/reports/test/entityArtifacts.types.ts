import type { runDocument } from './entityArtifacts';

export type Altered = (document: ReturnType<typeof runDocument>, state: string) => unknown;
