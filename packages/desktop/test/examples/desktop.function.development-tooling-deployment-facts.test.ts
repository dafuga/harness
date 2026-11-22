import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	deploymentFacts,
	receiptFacts
} from '../../src/components/development-tooling/deploymentFacts';
import type {
	DeploymentActivity,
	DeploymentReceipt
} from '../../src/models/development-tooling/Deployment.types';

function activity(overrides: Partial<DeploymentActivity> = {}): DeploymentActivity {
	return {
		phase: 'building',
		detail: 'Building source commit',
		sourceEnvironment: null,
		id: '0d9b6e42-a1f3-4c7e-8b25-9e3f1a6c7d08',
		projectId: 'local-4f0c9a1e7b2d835c6e9f1a40d7b3c26e8f5a9d0c1b4e7372a6d9f3c8e1b05a42',
		projectName: 'field-notes-site',
		environment: 'dev',
		commit: '2b7d9f04a6c1e83d5f0b7a2c94e6d1f8a3b5c709',
		branch: 'main',
		steps: [
			{ id: 'preparing', title: 'Prepare source' },
			{ id: 'checking', title: 'Run checks' },
			{ id: 'building', title: 'Build source' },
			{ id: 'uploading', title: 'Deploy to Cloudflare' },
			{ id: 'verifying', title: 'Verify health' }
		],
		step: 'building',
		error: null,
		receipt: null,
		createdAt: '2026-11-15T16:45:12.604Z',
		startedAt: null,
		updatedAt: '2026-11-15T16:45:12.604Z',
		finishedAt: null,
		...overrides
	};
}

const preprodReceipt: DeploymentReceipt = {
	environment: 'preprod',
	commit: '8e41c0d2f9a7b35e61d4c2a0f8b9e7d3c5a1f604',
	branch: 'main',
	updatedAt: '2026-11-15T14:06:01.612Z',
	adapter: 'cloudflare',
	deploymentId: '3f9a1c2e',
	configuration: 'c0f3a6d9e2b5470816fa9d3c2e7b1a84d5f6093be2c17a8f4d6e9b03a5c28f17',
	url: 'https://3f9a1c2e.field-notes-site.pages.dev'
};

const developmentReceipt: DeploymentReceipt = {
	environment: 'dev',
	commit: '2b7d9f04a6c1e83d5f0b7a2c94e6d1f8a3b5c709',
	branch: 'main',
	updatedAt: '2026-11-15T12:30:48.227Z',
	adapter: 'cloudflare',
	deploymentId: '7b1e4f0a-3c2d-4e5f-9a8b-1c2d3e4f5a6b',
	configuration: '5a9e21c4b07d3f68e1a4c9b2d70f35e8a6c1d4f97b03e2a8c5d91f6e4b720a3d',
	url: 'https://field-notes-api-dev.example-team.workers.dev'
};

const queuedDeployment = activity({
	phase: 'queued',
	detail: 'Waiting for a deployment worker',
	step: null
});

const completedDeployment = activity({
	phase: 'complete',
	detail: 'Deployed to preprod',
	sourceEnvironment: 'stage',
	environment: 'preprod',
	commit: '8e41c0d2f9a7b35e61d4c2a0f8b9e7d3c5a1f604',
	step: 'verifying',
	receipt: preprodReceipt,
	createdAt: '2026-11-15T14:01:09.880Z',
	startedAt: '2026-11-15T14:01:11.023Z',
	updatedAt: '2026-11-15T14:06:01.944Z',
	finishedAt: '2026-11-15T14:06:01.944Z'
});

test('Formats deployment identity and available timestamps', () => {
	const queuedRows = deploymentFacts(queuedDeployment);
	const completedRows = deploymentFacts(completedDeployment);

	expect(queuedRows).toEqual([
		{ name: 'Project', value: 'field-notes-site', format: 'text' },
		{ name: 'Branch', value: 'main', format: 'code' },
		{ name: 'Commit', value: '2b7d9f04a6c1e83d5f0b7a2c94e6d1f8a3b5c709', format: 'code' },
		{ name: 'Queued', value: '2026-11-15T16:45:12.604Z', format: 'time' }
	]);
	expect(completedRows).toEqual([
		{ name: 'Project', value: 'field-notes-site', format: 'text' },
		{ name: 'Branch', value: 'main', format: 'code' },
		{ name: 'Commit', value: '8e41c0d2f9a7b35e61d4c2a0f8b9e7d3c5a1f604', format: 'code' },
		{ name: 'Started', value: '2026-11-15T14:01:11.023Z', format: 'time' },
		{ name: 'Finished', value: '2026-11-15T14:06:01.944Z', format: 'time' }
	]);
	recordExampleCases(
		{
			unitId: 'desktop.function.development-tooling-deployment-facts',
			symbol: 'deploymentFacts',
			state: 'formats-deployment-identity-and-available-timestamps',
			evidence: 'examples-cases',
			file: 'formats-deployment-identity-and-available-timestamps.json'
		},
		[
			{
				name: 'queued deployment uses its creation time',
				input: queuedDeployment,
				output: queuedRows
			},
			{
				name: 'completed deployment keeps its source and timing',
				input: completedDeployment,
				output: completedRows
			}
		]
	);
});

test('Formats verified receipt facts', () => {
	const missingVerification: DeploymentReceipt = { ...developmentReceipt, updatedAt: '' };
	const preprodRows = receiptFacts(preprodReceipt);
	const developmentRows = receiptFacts(developmentReceipt);
	const missingVerificationRows = receiptFacts(missingVerification);

	expect(preprodRows).toEqual([
		{ name: 'Deployment', value: '3f9a1c2e', format: 'code' },
		{ name: 'Address', value: 'https://3f9a1c2e.field-notes-site.pages.dev', format: 'text' },
		{ name: 'Verified', value: '2026-11-15T14:06:01.612Z', format: 'time' }
	]);
	expect(developmentRows).toEqual([
		{ name: 'Deployment', value: '7b1e4f0a-3c2d-4e5f-9a8b-1c2d3e4f5a6b', format: 'code' },
		{
			name: 'Address',
			value: 'https://field-notes-api-dev.example-team.workers.dev',
			format: 'text'
		},
		{ name: 'Verified', value: '2026-11-15T12:30:48.227Z', format: 'time' }
	]);
	expect(missingVerificationRows).toEqual([
		{ name: 'Deployment', value: '7b1e4f0a-3c2d-4e5f-9a8b-1c2d3e4f5a6b', format: 'code' },
		{
			name: 'Address',
			value: 'https://field-notes-api-dev.example-team.workers.dev',
			format: 'text'
		}
	]);
	recordExampleCases(
		{
			unitId: 'desktop.function.development-tooling-deployment-facts',
			symbol: 'receiptFacts',
			state: 'formats-verified-receipt-facts',
			evidence: 'examples-cases',
			file: 'formats-verified-receipt-facts.json'
		},
		[
			{
				name: 'preprod receipt includes its verified time',
				input: preprodReceipt,
				output: preprodRows
			},
			{
				name: 'development receipt retains its public address',
				input: developmentReceipt,
				output: developmentRows
			},
			{
				name: 'receipt without a verification time omits that row',
				input: missingVerification,
				output: missingVerificationRows
			}
		]
	);
});
