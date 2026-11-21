import type { DeployProject } from '../../validators/execution-runtimes/DeployManifestValidator';

export interface DeployDockerAdapterConfig {
	project: DeployProject;
}
