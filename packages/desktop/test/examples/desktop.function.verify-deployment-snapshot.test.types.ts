import type { ReviewedDeployment } from '../../src/services/development-tooling/DeploymentService';

export type Environment = ReviewedDeployment['plan']['environment'];
