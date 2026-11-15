import {
	deploymentEnvironments,
	deploymentSteps,
	type DeploymentActivity,
	type DeploymentBridge,
	type DeploymentReceipt
} from '../../../../../desktop/src/models/development-tooling/Deployment.types';
import type { DesktopCase } from './desktopData.svelte';
import { commits } from './explorerData';
import { desktopData } from './sealedData';
import { stamp } from './shared';

const receipt: DeploymentReceipt = {
	environment: 'preprod',
	commit: commits.tip,
	branch: desktopData.branch,
	updatedAt: stamp,
	adapter: 'cloudflare',
	deploymentId: 'synthetic-preview',
	url: 'https://preview.example.invalid'
};
const deployment: DeploymentActivity = {
	id: 'preview-deployment',
	projectId: desktopData.project.id,
	projectName: desktopData.project.name,
	environment: 'prod',
	sourceEnvironment: 'preprod',
	commit: commits.tip,
	branch: desktopData.branch,
	steps: deploymentSteps.map((step) => ({ ...step })),
	phase: 'building',
	step: 'building',
	detail: 'Building the verified preprod commit',
	error: null,
	receipt: null,
	createdAt: stamp,
	startedAt: stamp,
	updatedAt: stamp,
	finishedAt: null
};
/** Synthetic, isolated reads: no fixture operation can contact or deploy to a real target. */
export const deploymentBridge: DeploymentBridge = {
	deploymentStatus: async () =>
		deploymentEnvironments.map((environment) => ({
			environment,
			available: true,
			reason: '',
			receipt: { ...receipt, environment }
		})),
	deploymentActivities: async () => [deployment],
	planDeployment: async () => ({
		id: 'preview-promotion',
		environment: 'prod',
		commit: commits.tip,
		branch: desktopData.branch,
		adapter: 'cloudflare',
		target: 'synthetic-preview',
		steps: deploymentSteps.map((step) => step.title),
		blockers: [],
		expiresAt: '2026-10-20T11:00:00Z',
		promotion: {
			preprod: receipt,
			production: { ...receipt, environment: 'prod', commit: commits.middle },
			commitsBehind: 2
		}
	}),
	startDeployment: async () => {
		throw new Error('Preview fixtures cannot start deployments.');
	}
};
const finished = { finishedAt: stamp, updatedAt: stamp };
const variants: Record<string, DeploymentActivity> = {
	failed: {
		...deployment,
		...finished,
		phase: 'failed',
		step: 'building',
		detail: 'The build stopped before anything was uploaded.',
		error: 'Build exited with code 1: order-card.ts has no export named OrderCard.'
	},
	succeeded: {
		...deployment,
		...finished,
		phase: 'complete',
		step: 'verifying',
		detail: 'The new revision is live and its health check passed.',
		receipt: {
			environment: 'prod',
			commit: commits.tip,
			branch: desktopData.branch,
			updatedAt: stamp,
			adapter: 'cloudflare',
			deploymentId: 'orders-prod-42',
			url: 'https://orders.example.invalid'
		}
	}
};
/** Failed, finished and destination-only presentations of the same deployment; the default is unchanged. */
export function deploymentVariantProps<T extends object>(props: T, variant: string) {
	if (variant === 'no-identity') return { ...props, showIdentity: false };
	const changed = variants[variant];
	return changed ? { ...props, deployment: changed } : props;
}
export const deploymentCases: Record<string, DesktopCase> = {
	'desktop.component.deployment-activity': (d) => ({ workspace: d.workspace }),
	'desktop.component.deployment-dialog': (d) => ({ workspace: d.workspace }),
	'desktop.component.environment-picker': (d) => ({ workspace: d.workspace }),
	'desktop.component.deployment-details': () => ({ deployment }),
	'desktop.component.deployment-progress': () => ({ deployment }),
	'desktop.component.deployment-route': () => ({ deployment })
};
