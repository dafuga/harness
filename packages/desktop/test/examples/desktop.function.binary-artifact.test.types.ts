import type { binaryArtifact } from '../../src/utils/reports-media/binaryArtifact';

export type Input = Parameters<typeof binaryArtifact>[0];

export type Output = Awaited<ReturnType<typeof binaryArtifact>>;
