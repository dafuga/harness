import type { DeploymentEnvironment } from '../models/Deployment.types';
/** Automatic changes never cross the explicit-deployment boundary. */
export function changeEnvironment(environment: DeploymentEnvironment): DeploymentEnvironment[] {
	if (!['dev', 'stage', 'preprod', 'prod'].includes(environment))
		throw new Error('Unknown deployment environment.');
	if (environment === 'dev') return ['dev'];
	return environment === 'stage' ? ['dev', 'stage'] : ['dev', 'stage', 'preprod'];
}
