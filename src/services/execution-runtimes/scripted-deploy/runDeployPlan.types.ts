// @harness-uid u_3diuooz2wz
import type { DeployBroker } from '../../../core/execution-runtimes/scripted-deploy/broker';
import type { DeployRunRepository } from '../../../repositories/execution-runtimes/DeployRunRepository';
import type {
	DeployProject,
	DeployRegistry
} from '../../../validators/execution-runtimes/DeployManifestValidator';
import type { DeployPlanning } from './DeployPlanning';
import type { DeployVerification } from './DeployVerification';

export type DeployRunContext = {
	registry: DeployRegistry;
	config: DeployProject;
	store: DeployRunRepository;
	broker: DeployBroker;
	planning: DeployPlanning;
	verification: DeployVerification;
};
