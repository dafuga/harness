// @harness-uid u_ludgaead75
import type { DeploymentProgress } from '../../models/development-tooling/Deployment.types';
import type { DeploymentReceipt } from '../../models/development-tooling/Deployment.types';
import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';

export class UnknownDeploymentError extends Error {
	override name = 'UnknownDeploymentError';
}

export class DeploymentCapacityError extends Error {
	override name = 'DeploymentCapacityError';
}

export class DeploymentAlreadyStartedError extends Error {
	override name = 'DeploymentAlreadyStartedError';
}

export class RequiredLowerEnvironmentDeploymentError extends Error {
	override name = 'RequiredLowerEnvironmentDeploymentError';
}

export class MissingDeploymentTargetError extends Error {
	override name = 'MissingDeploymentTargetError';
}

export type Work = (
	update: (phase: DeploymentProgress['phase'], detail: string) => void,
	predecessor?: DeploymentReceipt
) => Promise<DeploymentReceipt>;

export interface Entry {
	root: string;
	activity: DeploymentActivity;
	completion: Promise<DeploymentReceipt>;
}
