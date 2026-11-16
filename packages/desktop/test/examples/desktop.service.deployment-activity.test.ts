import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { DeploymentActivityService } from '../../src/services/development-tooling/DeploymentActivityService';

const root = '/workspace/project';
const receipt = {
	environment: 'dev' as const,
	commit: '0123456789abcdef0123456789abcdef01234567',
	branch: 'main',
	updatedAt: '2026-11-14T12:02:00.000Z',
	adapter: 'cloudflare' as const,
	deploymentId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
	url: 'https://project-dev.example.test',
	configuration: '7b1a7f5e02f4a0f56f7dfc3a8ef3e46236d158fcd0d88633fbe965fdc74f39ed'
};
const reviewed = {
	sourceEnvironment: null,
	plan: {
		id: receipt.deploymentId,
		environment: 'dev' as const,
		commit: receipt.commit,
		branch: receipt.branch,
		adapter: 'cloudflare' as const,
		target: 'workers · project-dev · dev · account 0123456789abcdef0123456789abcdef · https://project-dev.example.test',
		steps: ['Prepare source', 'Run checks', 'Build source', 'Deploy to Cloudflare', 'Verify health'],
		blockers: [],
		expiresAt: '2026-11-14T12:05:00.000Z'
	},
	fingerprint: '7b1a7f5e02f4a0f56f7dfc3a8ef3e46236d158fcd0d88633fbe965fdc74f39ed',
	root,
	projectId: null,
	target: {
		environment: 'dev' as const,
		kind: 'workers' as const,
		config: 'packages/desktop/wrangler.toml',
		name: 'project-dev',
		accountId: '0123456789abcdef0123456789abcdef',
		tokenEnv: 'CLOUDFLARE_API_TOKEN_DEV',
		wranglerEnvironment: 'dev',
		branch: 'main',
		output: 'packages/desktop/dist',
		healthUrl: 'https://project-dev.example.test'
	},
	predecessor: null
};

test('Schedules deployment activity and records its completion', async () => {
	const service = new DeploymentActivityService();
	const initial = service.schedule(reviewed, async (update) => {
		update('building', 'Build source');
		return receipt;
	});
	const result = await service.wait(initial.id);
	await service.idle();
	const listed = service.list()[0];
	const missing = service.progress(initial.id, '/workspace/other');
	const unknown = await service.wait('missing').then(
		() => null,
		(error: unknown) => error instanceof Error ? { name: error.name, message: error.message } : null
	);
	const output = {
		initial: { id: initial.id, phase: initial.phase, detail: initial.detail },
		result,
		listed: listed && { id: listed.id, phase: listed.phase, receipt: listed.receipt },
		missing,
		unknown
	};
	expect(output.initial).toEqual({ id: receipt.deploymentId, phase: 'queued', detail: 'Queued for dev' });
	expect(output.listed?.phase).toBe('complete');
	expect(output.unknown?.message).toBe('Unknown deployment.');
	recordExampleCases(
		{
			unitId: 'desktop.service.deployment-activity',
			symbol: 'schedule',
			state: 'schedules-deployment-activity-and-records-its-completion',
			evidence: 'examples-cases',
			file: 'schedules-deployment-activity-and-records-its-completion.json'
		},
		[
			{
				name: 'A scheduled deployment progresses to a receipt and is listed as complete',
				input: { reviewed, work: 'update building and return receipt', progressRoot: root },
				output
			}
		]
	);
});
