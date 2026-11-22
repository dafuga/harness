// @harness-uid u_sbr2ymmwy7
import type { DeploymentPlugin } from '../../models/development-tooling/Deployment.types';
import type { DeployExecutor } from '../../models/development-tooling/Deployment.types';
import type { CloudflareTarget } from '../../models/development-tooling/Deployment.types';
import type { DeploymentEnvironment } from '../../models/development-tooling/Deployment.types';
import type { DeploymentPlan } from '../../models/development-tooling/Deployment.types';
import type { DeploymentReceipt } from '../../models/development-tooling/Deployment.types';
import type { DeploymentActivityService } from './DeploymentActivityService';

export interface DeploymentOptions {
	plugin?: DeploymentPlugin;
	execute?: DeployExecutor;
	health?: (target: CloudflareTarget) => Promise<boolean>;
	activities?: DeploymentActivityService;
}

export interface ReviewedDeployment {
	sourceEnvironment: DeploymentEnvironment | null;
	plan: DeploymentPlan;
	fingerprint: string;
	root: string;
	projectId: string | null;
	target?: CloudflareTarget;
	predecessor: DeploymentReceipt | null;
}

/** A deployment refused before it starts because a precondition is not met. */
export class DeploymentPreconditionError extends Error {
	override name = 'DeploymentPreconditionError';
}
