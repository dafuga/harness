// @harness-uid u_2alg3pplzk
import type { DeploymentEnvironment } from '../../models/development-tooling/Deployment.types';
import { UnknownDeploymentEnvironmentError } from './changeEnvironment.types';
/** Automatic changes never cross the explicit-deployment boundary. */
export function changeEnvironment(environment: DeploymentEnvironment): DeploymentEnvironment[] {
	if (!['dev', 'stage', 'preprod', 'prod'].includes(environment))
		throw new UnknownDeploymentEnvironmentError('Unknown deployment environment.');
	if (environment === 'dev') return ['dev'];
	return environment === 'stage' ? ['dev', 'stage'] : ['dev', 'stage', 'preprod'];
}
