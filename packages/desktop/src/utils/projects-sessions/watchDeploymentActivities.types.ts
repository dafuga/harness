// @harness-uid u_y3zhqkah5v
import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';

export interface Events {
	version: () => number;
	received: (items: DeploymentActivity[], version: number) => void;
	failed: (message: string) => void;
}
