// @harness-uid u_k4lvak3h7p
import type { DeploymentReceipt } from '../../models/development-tooling/Deployment.types';

/** A comparison row: an environment's name and the receipt of its deployment, if any. */
export interface CommitRow {
	name: string;
	item: DeploymentReceipt | null;
}
