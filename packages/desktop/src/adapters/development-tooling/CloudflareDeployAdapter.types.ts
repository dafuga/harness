import type { DeployExecutor } from '../../models/development-tooling/Deployment.types';

export interface Options {
	execute?: DeployExecutor;
	request?: (input: string, init?: RequestInit) => Promise<Response>;
}
