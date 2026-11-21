import type {
	Environment,
	Release
} from '../../../core/execution-runtimes/scripted-deploy/contracts';

export type DeployRequest = {
	environment: Environment;
	release: Release | null;
	source?: string;
	from?: string;
	rollback?: string;
};
