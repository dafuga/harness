import type { DeploymentConfig } from '../../src/models/development-tooling/Deployment.types';
import type { deploymentStatus } from '../../src/utils/projects-sessions/deploymentState';

export type Target = NonNullable<DeploymentConfig['targets']['dev']>;

export type Status = Awaited<ReturnType<typeof deploymentStatus>>;
