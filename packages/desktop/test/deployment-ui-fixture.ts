import { deploymentSteps } from '../src/models/Deployment.types';
import type { DeploymentActivity } from '../src/models/Deployment.types';
export function deploymentActivityFixture(
	values: Partial<DeploymentActivity> = {}
): DeploymentActivity {
	return {
		id: 'job',
		projectId: 'project',
		projectName: 'Test project',
		environment: 'prod',
		sourceEnvironment: 'preprod',
		commit: 'a'.repeat(40),
		branch: 'main',
		steps: deploymentSteps.map((step) => ({ ...step })),
		phase: 'checking',
		step: 'checking',
		detail: 'Checking source commit',
		error: null,
		receipt: null,
		createdAt: '2026-10-20T10:00:00.000Z',
		startedAt: '2026-10-20T10:00:00.000Z',
		updatedAt: '2026-10-20T10:01:00.000Z',
		finishedAt: null,
		...values
	};
}
