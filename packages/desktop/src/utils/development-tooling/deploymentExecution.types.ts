import type { DeploymentOptions } from '../../services/development-tooling/DeploymentService';
import type { DeploymentPlugin } from '../../models/development-tooling/Deployment.types';
import type { DeploymentProgress } from '../../models/development-tooling/Deployment.types';
import type { CloudflareTarget } from '../../models/development-tooling/Deployment.types';
import type { DeploymentReceipt } from '../../models/development-tooling/Deployment.types';

export interface Runtime extends DeploymentOptions {
	plugin: DeploymentPlugin;
	update: (phase: DeploymentProgress['phase'], detail: string) => void;
}

export type Captured = { target: CloudflareTarget; destination: DeploymentReceipt | null };
