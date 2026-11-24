// @harness-uid u_vmj2plxn7l
import type { DeployRegistry } from '../../validators/execution-runtimes/DeployManifestValidator';

export interface DeployOptions {
	registry?: string;
	ref?: string;
	release?: string;
	from?: string;
	receipt?: string;
	plan?: boolean;
	publishPlan?: boolean;
	waitForGo?: boolean;
	scope?: boolean;
}

export type PlanPublication = { registry: DeployRegistry; smoke: string; publish?: boolean };

export type Operation =
	| { kind: 'deploy'; project: string; environment: string }
	| { kind: 'prepare'; project: string }
	| { kind: 'rollback'; project: string; environment: string; run: string }
	| { kind: 'status'; run: string }
	| { kind: 'signoff'; run: string }
	| { kind: 'resume'; run: string };
