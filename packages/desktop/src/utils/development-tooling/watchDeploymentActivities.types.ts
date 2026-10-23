import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';

export interface Events {
	version: () => number;
	received: (items: DeploymentActivity[], version: number) => void;
	failed: (message: string) => void;
}
