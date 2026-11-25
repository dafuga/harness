// @harness-uid u_q4jcoafzvg
import type { DeployBroker } from '../../../core/execution-runtimes/scripted-deploy/broker';
import type { DeployRunRepository } from '../../../repositories/execution-runtimes/DeployRunRepository';
import type {
	DeployProject,
	DeployRegistry
} from '../../../validators/execution-runtimes/DeployManifestValidator';

export type DeploySignoffContext = {
	project: string;
	config: DeployProject;
	registry: DeployRegistry;
	store: DeployRunRepository;
	broker: DeployBroker;
};
