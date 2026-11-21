// @harness-uid u_f77zx26wcb
import type { DeployProject } from '../../validators/execution-runtimes/DeployManifestValidator';

export interface DeployDockerAdapterConfig {
	project: DeployProject;
}

export type LocalPhase = 'build' | 'smoke' | 'cleanup';
