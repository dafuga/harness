// @harness-uid u_pkn44eqxgd
import type { Plan } from '../../../core/execution-runtimes/scripted-deploy/contracts';
import type { DeployRegistry } from '../../../validators/execution-runtimes/DeployManifestValidator';
import type { RunnerInput } from '../../../core/execution-runtimes/scripted-deploy/approvalInbox.types';

export type InboxConfig = NonNullable<DeployRegistry['approvalInbox']>;
export type RunnerScope = {
	project: string;
	environment: Plan['environment'];
};
export type RunScope = Omit<Extract<RunnerInput, { kind: 'admit' }>, 'kind'>;
