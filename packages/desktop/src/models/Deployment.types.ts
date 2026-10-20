import type { ProjectContext } from './ProjectContext.types';
export const deploymentEnvironments = ['dev', 'stage', 'preprod', 'prod'] as const;
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
	phase: 'preparing' | 'checking' | 'building' | 'uploading' | 'verifying' | 'complete' | 'failed';
	detail: string;
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
	deploymentProgress?(input: DeployInput): Promise<DeploymentProgress | null>;
	deploymentStatus?(input?: ProjectContext): Promise<DeploymentStatus[]>;
	planDeployment?(input: DeploymentQuery): Promise<DeploymentPlan>;
	deploy?(input: DeployInput): Promise<DeploymentReceipt>;
}
