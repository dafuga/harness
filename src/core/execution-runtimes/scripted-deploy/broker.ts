// @harness-uid u_bepb2gipf3
import { ExpectedCliError } from '../../development-tooling/errors';
import { z } from 'zod';
import {
	deployment,
	observation,
	signedProof,
	type Environment,
	type Observation,
	type Plan,
	type Proof
} from './contracts';
import type { ApprovalReceipt } from './approvalInbox.types';
import { runProcess } from './runProcess';
import type {
	DeployProject,
	DeployRegistry
} from '../../../validators/execution-runtimes/DeployManifestValidator';

const reconciliation = z.discriminatedUnion('status', [
	z.strictObject({ status: z.literal('pending') }),
	z.strictObject({ status: z.literal('not-applied'), observed: observation }),
	z.strictObject({ status: z.literal('applied'), result: deployment })
]);

export class DeployBroker {
	constructor(
		private readonly registry: DeployRegistry,
		private readonly config: DeployProject
	) {}

	inspect(project: string, environment: Environment, manifest: string): Promise<Observation> {
		return this.request(
			'inspect',
			{
				project,
				environment,
				manifest,
				target: this.config.targets[environment]?.id
			},
			observation
		);
	}

	authorize(plan: Plan, decision?: ApprovalReceipt): Promise<Proof> {
		return this.request('authorize', { plan, ...(decision ? { decision } : {}) }, signedProof);
	}

	apply(plan: Plan, proof: Proof, artifact: string | null) {
		return this.request('apply', { plan, proof, artifact }, deployment);
	}

	reconcile(plan: Plan) {
		return this.request('reconcile', { plan }, reconciliation);
	}

	async note(item: string, message: string): Promise<void> {
		await runProcess(this.registry.tracker, ['note', item, message], {
			description: 'Tracker receipt recording'
		});
	}

	private async request<T>(operation: string, payload: unknown, schema: z.ZodType<T>): Promise<T> {
		const output = await runProcess(this.registry.broker, [operation], {
			stdin: payload,
			description: 'Deployment broker ' + operation,
			timeout: 150_000
		});
		try {
			return schema.parse(JSON.parse(output));
		} catch {
			throw new ExpectedCliError('Deployment broker returned invalid ' + operation + ' evidence.');
		}
	}
}
