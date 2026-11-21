import type { DeployOptions, Operation } from './runDeploy.types';
import { signoffScope } from '../../core/execution-runtimes/scripted-deploy/proofs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ZodError } from 'zod';
import {
	environment,
	name,
	sha,
	signedProof
} from '../../core/execution-runtimes/scripted-deploy/contracts';
import { DeployRunRepository } from '../../repositories/execution-runtimes/DeployRunRepository';
import { ScriptedDeployService } from '../../services/execution-runtimes/ScriptedDeployService';
import {
	DeployManifestValidator,
	privateFile,
	readJson
} from '../../validators/execution-runtimes/DeployManifestValidator';

export type { DeployOptions } from './runDeploy.types';

export async function deployOperation(operation: Operation, options: DeployOptions): Promise<void> {
	try {
		const result = await execute(operation, options);
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(
			error instanceof ZodError || !(error instanceof Error)
				? 'Invalid deployment input or typed phase evidence.'
				: error.message
		);
		process.exitCode = 1;
	}
}

async function execute(operation: Operation, options: DeployOptions): Promise<unknown> {
	const registry = new DeployManifestValidator().read(
		options.registry ?? join(homedir(), '.config/harness/deploy.json')
	);
	const store = new DeployRunRepository(registry.state);
	if (operation.kind === 'status') {
		const record = store.get(operation.run);
		return options.scope ? { scope: signoffScope(record) } : record;
	}
	const project = operationProject(operation, store);
	const config = registry.projects[project];
	if (!config) throw new Error('Project is absent from the trusted deploy registry.');
	const service = new ScriptedDeployService(registry, project, config);
	if (operation.kind === 'resume') return service.recovery.resume(operation.run);
	if (operation.kind === 'prepare') return service.prepare(sha.parse(options.ref));
	if (operation.kind === 'signoff') return recordSignoff(service, operation.run, options.receipt);
	const target = environment.parse(operation.environment);
	if (operation.kind === 'rollback') {
		const input = { environment: target, release: null, rollback: operation.run };
		return options.plan ? service.planning.plan(input) : service.deploy(input);
	}
	return routeDeploy({ service, target, store }, options);
}

async function routeDeploy(
	{
		service,
		target,
		store
	}: {
		service: ScriptedDeployService;
		target: 'staging' | 'preprod' | 'prod';
		store: DeployRunRepository;
	},
	options: DeployOptions
) {
	if (options.ref && (options.release || target !== 'staging')) {
		throw new Error('--ref is staging-only and cannot be combined with --release.');
	}
	if (!options.release && !options.ref)
		throw new Error('Select --ref or --release for this deployment.');
	const source = options.ref ? sha.parse(options.ref) : undefined;
	const release = options.release ? store.getRelease(options.release) : null;
	if (options.plan)
		return service.planning.plan({ environment: target, release, from: options.from, source });
	const prepared = source ? await service.prepare(source) : release;
	return service.deploy({ environment: target, release: prepared, from: options.from });
}

function operationProject(operation: Operation, store: DeployRunRepository): string {
	return 'project' in operation
		? name.parse(operation.project)
		: store.get(operation.run).plan.project;
}

function recordSignoff(service: ScriptedDeployService, run: string, receipt: string | undefined) {
	if (!receipt) throw new Error('A signed receipt file is required.');
	return service.signoff(run, signedProof.parse(readJson(privateFile(receipt))));
}
