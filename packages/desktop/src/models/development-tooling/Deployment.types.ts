import type { ProjectContext } from '../ProjectContext.types';
import type { deploymentEnvironments, deploymentSteps } from './DeploymentValues';

export type DeploymentEnvironment = (typeof deploymentEnvironments)[number];

export interface DeploymentReceipt {
	environment: DeploymentEnvironment;
	commit: string;
	branch: string;
	updatedAt: string;
	adapter: string;
	deploymentId: string;
	configuration?: string;
	url: string;
}

export interface DeploymentStatus {
	environment: DeploymentEnvironment;
	receipt: DeploymentReceipt | null;
	available: boolean;
	reason: string;
}

export interface DeploymentProgress {
	phase:
		| 'queued'
		| 'preparing'
		| 'checking'
		| 'building'
		| 'uploading'
		| 'verifying'
		| 'complete'
		| 'failed';
	detail: string;
}

export type DeploymentStep = (typeof deploymentSteps)[number]['id'];

export interface DeploymentActivity extends DeploymentProgress {
	sourceEnvironment: DeploymentEnvironment | null;
	id: string;
	projectId: string | null;
	projectName: string;
	environment: DeploymentEnvironment;
	commit: string;
	branch: string;
	steps: { id: DeploymentStep; title: string }[];
	step: DeploymentStep | null;
	error: string | null;
	receipt: DeploymentReceipt | null;
	createdAt: string;
	startedAt: string | null;
	updatedAt: string;
	finishedAt: string | null;
}

export interface ProductionPromotion {
	preprod: DeploymentReceipt | null;
	production: DeploymentReceipt | null;
	commitsBehind: number | null;
}

export interface DeploymentPlan {
	promotion?: ProductionPromotion;
	id: string;
	environment: DeploymentEnvironment;
	commit: string;
	branch: string;
	adapter: string;
	target: string;
	steps: string[];
	blockers: string[];
	expiresAt: string;
}

export interface DeploymentQuery extends ProjectContext {
	environment: DeploymentEnvironment;
	commit: string;
}

export interface DeployInput extends ProjectContext {
	planId: string;
}

export interface DeployCommand {
	args: string[];
	cwd: string;
	env?: Record<string, string>;
}

export type DeployExecutor = (command: DeployCommand) => Promise<string>;

export interface CloudflareTarget {
	environment: DeploymentEnvironment;
	kind: 'workers' | 'pages';
	config: string;
	name: string;
	accountId: string;
	tokenEnv: string;
	wranglerEnvironment: string;
	branch: string;
	output: string;
	healthUrl: string;
}

export interface DeploymentConfig {
	fingerprint?: string;
	sourceBranch: string;
	targets: Partial<Record<DeploymentEnvironment, CloudflareTarget>>;
}

export interface DeploymentPlugin {
	id: string;
	discover(root: string): Promise<DeploymentConfig>;
	deploy(
		target: CloudflareTarget,
		source: { root: string; commit: string }
	): Promise<{ deploymentId: string; url: string }>;
}

export interface DeploymentBridge {
	deploymentActivities?(): Promise<DeploymentActivity[]>;
	startDeployment?(input: DeployInput): Promise<DeploymentActivity>;
	deploymentProgress?(input: DeployInput): Promise<DeploymentProgress | null>;
	deploymentStatus?(input?: ProjectContext): Promise<DeploymentStatus[]>;
	planDeployment?(input: DeploymentQuery): Promise<DeploymentPlan>;
	deploy?(input: DeployInput): Promise<DeploymentReceipt>;
}
export { deploymentEnvironments, deploymentSteps } from './DeploymentValues';
