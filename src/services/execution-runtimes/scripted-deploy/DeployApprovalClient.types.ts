// @harness-uid u_pkn44eqxgd
import type { Plan } from '../../../core/execution-runtimes/scripted-deploy/contracts';
import type { DeployRegistry } from '../../../validators/execution-runtimes/DeployManifestValidator';

export type InboxConfig = NonNullable<DeployRegistry['approvalInbox']>;
export type RunnerScope = {
	project: string;
	environment: Exclude<Plan['environment'], 'staging'>;
};
