// @harness-uid u_vmj2plxn7l
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type { DeployOptions, Operation, PlanPublication } from './runDeploy.types';
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
import type { DeployRequest } from '../../services/execution-runtimes/scripted-deploy/DeployPlanning';
import { ScriptedDeployService } from '../../services/execution-runtimes/ScriptedDeployService';
import { publishReadOnlyPlan } from '../../services/execution-runtimes/scripted-deploy/requestDeployApproval';
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
	validateOptions(operation.kind, options);
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
	if (!config) throw new ExpectedCliError('Project is absent from the trusted deploy registry.');
	const service = new ScriptedDeployService(registry, project, config);
	const preview = { registry, smoke: config.scripts.smoke, publish: options.publishPlan };
	if (operation.kind === 'resume') return service.resume(operation.run);
	if (operation.kind === 'prepare') return service.prepare(sha.parse(options.ref));
	if (operation.kind === 'signoff') return recordSignoff(service, operation.run, options);
	const target = environment.parse(operation.environment);
	if (operation.kind === 'rollback') {
		const input = { environment: target, release: null, rollback: operation.run };
		return options.plan
			? publicPlan(service, input, preview)
			: service.deploy(input, options.waitForGo);
	}
	return routeDeploy({ service, target, store, preview }, options);
}

function validateOptions(kind: Operation['kind'], options: DeployOptions): void {
	if (options.waitForGo && (options.plan || !['deploy', 'rollback', 'signoff'].includes(kind)))
		throw new ExpectedCliError(
			'--wait-for-go applies only to deployment, rollback, or sign-off execution.'
		);
	if (
		options.publishPlan &&
		(!options.plan || !['deploy', 'rollback'].includes(kind) || options.ref)
	)
		throw new ExpectedCliError(
			'--publish-plan requires --plan with an immutable --release or a rollback run.'
		);
}

async function routeDeploy(
	{
		service,
		target,
		store,
		preview
	}: {
		service: ScriptedDeployService;
		target: 'staging' | 'preprod' | 'prod';
		store: DeployRunRepository;
		preview: PlanPublication;
	},
	options: DeployOptions
) {
	if (options.ref && (options.release || target !== 'staging')) {
		throw new ExpectedCliError('--ref is staging-only and cannot be combined with --release.');
	}
	if (!options.release && !options.ref)
		throw new ExpectedCliError('Select --ref or --release for this deployment.');
	if (options.waitForGo && options.ref)
		throw new ExpectedCliError('Prepare the artifact first and pass its immutable --release ID.');
	const source = options.ref ? sha.parse(options.ref) : undefined;
	const release = options.release ? store.getRelease(options.release) : null;
	if (options.plan)
		return publicPlan(
			service,
			{ environment: target, release, from: options.from, source },
			preview
		);
	const prepared = source ? await service.prepare(source) : release;
	return service.deploy(
		{ environment: target, release: prepared, from: options.from },
		options.waitForGo
	);
}

function operationProject(operation: Operation, store: DeployRunRepository): string {
	return 'project' in operation
		? name.parse(operation.project)
		: store.get(operation.run).plan.project;
}

function recordSignoff(
	service: ScriptedDeployService,
	run: string,
	{ receipt, waitForGo }: DeployOptions
) {
	if (!receipt) throw new ExpectedCliError('A signed receipt file is required.');
	return service.signoff(run, signedProof.parse(readJson(privateFile(receipt))), waitForGo);
}

async function publicPlan(
	service: ScriptedDeployService,
	input: DeployRequest,
	preview: PlanPublication
) {
	const result = await service.planning.plan(input);
	if (preview.publish)
		await publishReadOnlyPlan(preview.registry, result, {
			smoke: preview.smoke,
			rollbackFrom: input.rollback
		});
	const { plan, parity, source } = result;
	return { plan, parity, source };
}
