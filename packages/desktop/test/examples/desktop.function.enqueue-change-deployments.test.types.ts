import type { enqueueChangeDeployments } from '../../src/utils/projects-sessions/enqueueChangeDeployments';

export type Runtime = Parameters<typeof enqueueChangeDeployments>[2];

export type Input = Parameters<typeof enqueueChangeDeployments>[1];
