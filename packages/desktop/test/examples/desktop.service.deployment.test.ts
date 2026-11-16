import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { DeploymentService } from '../../src/services/development-tooling/DeploymentService';

const session = {
	projectId: 'project-example',
	root: '/tmp/deployment-example',
	assertProject: (_projectId?: string) => undefined
} as never;

test('Lists deployment activities', () => {
	const service = new DeploymentService(session);
	const output = service.activities();
	expect(output).toEqual([]);
	recordExampleCases(
		{
			unitId: 'desktop.service.deployment',
			symbol: 'activities',
			state: 'lists-deployment-activities',
			evidence: 'examples-cases',
			file: 'lists-deployment-activities.json'
		},
		[{ name: 'An idle service has no activities', input: {}, output }]
	);
});

test('Looks up deployment progress by plan and project root', async () => {
	const service = new DeploymentService(session);
	const output = await service.progress({ planId: 'plan-id-returned-by-plan' });
	expect(output).toBeNull();
	recordExampleCases(
		{
			unitId: 'desktop.service.deployment',
			symbol: 'progress',
			state: 'looks-up-deployment-progress-by-plan-and-project-root',
			evidence: 'examples-cases',
			file: 'looks-up-deployment-progress-by-plan-and-project-root.json'
		},
		[
			{
				name: 'An unknown plan has no progress',
				input: { planId: 'plan-id-returned-by-plan' },
				output
			}
		]
	);
});

test('Refuses automatic production deployment', async () => {
	const service = new DeploymentService(session);
	let error: unknown;
	try {
		await service.automatic({
			environment: 'prod',
			commit: '9fceb02e63b57330f44d8a4bdc16c55b255d6bce'
		});
	} catch (caught) {
		error = caught;
	}
	expect(error).toMatchObject({
		name: 'DeploymentPreconditionError',
		message: 'Production requires the Deploy UI.'
	});
	recordExampleCases(
		{
			unitId: 'desktop.service.deployment',
			symbol: 'automatic',
			state: 'refuses-automatic-production-deployment',
			evidence: 'examples-cases',
			file: 'refuses-automatic-production-deployment.json'
		},
		[
			{
				name: 'Production is reserved for the Deploy UI',
				input: {
					environment: 'prod',
					commit: '9fceb02e63b57330f44d8a4bdc16c55b255d6bce'
				},
				error: { name: 'DeploymentPreconditionError', message: 'Production requires the Deploy UI.' }
			}
		]
	);
});
