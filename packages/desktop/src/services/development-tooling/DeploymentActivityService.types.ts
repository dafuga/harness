import type { DeploymentProgress } from '../../models/development-tooling/Deployment.types';
import type { DeploymentReceipt } from '../../models/development-tooling/Deployment.types';
import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';

export type Work = (
	update: (phase: DeploymentProgress['phase'], detail: string) => void,
	predecessor?: DeploymentReceipt
) => Promise<DeploymentReceipt>;

export interface Entry {
	root: string;
	activity: DeploymentActivity;
	completion: Promise<DeploymentReceipt>;
}
