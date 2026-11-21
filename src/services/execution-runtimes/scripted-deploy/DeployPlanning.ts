import { randomUUID } from 'node:crypto';
import {
	hash,
	type Environment,
	type Journal,
	type Observation,
	type Plan,
	type Release
} from '../../../core/execution-runtimes/scripted-deploy/contracts';
import {
	assertObservation,
	assertTargetProfile,
	parityReport,
	sameVersion
} from '../../../core/execution-runtimes/scripted-deploy/parity';
import { verifySignoff } from '../../../core/execution-runtimes/scripted-deploy/proofs';
import { validateSource } from '../../../core/execution-runtimes/scripted-deploy/releaseFiles';
import type { DeployBroker } from '../../../core/execution-runtimes/scripted-deploy/broker';
import type { DeployRunRepository } from '../../../repositories/execution-runtimes/DeployRunRepository';
import {
	manifestDigest,
	type DeployProject,
	type DeployRegistry
} from '../../../validators/execution-runtimes/DeployManifestValidator';

export type DeployRequest = {
	environment: Environment;
	release: Release | null;
	source?: string;
	from?: string;
	rollback?: string;
};
const environments = ['staging', 'preprod', 'prod'] as const;
export class DeployPlanning {
	constructor(
		private readonly context: { config: DeployProject; project: string; registry: DeployRegistry },
		private readonly store: DeployRunRepository,
		private readonly broker: DeployBroker
	) {}

	async plan(input: DeployRequest) {
		const { environment, release, rollback } = input;
		if (!this.context.config.targets[environment])
			throw new Error('Environment is absent from the trusted project manifest.');
		const manifest = manifestDigest(this.context.config);
		if (input.source) await validateSource(this.context.config, input.source);
		const current = await this.inventory(manifest);
		const previous = current[environment]!;
		const chain = this.predecessor(input, current);
		const restore = rollback ? this.restoreTarget(rollback, previous) : null;
		const parity = parityReport(this.context.config, current);
		const plan: Plan = {
			id: randomUUID(),
			project: this.context.project,
			environment,
			action: rollback ? 'rollback' : 'deploy',
			target: previous.target,
			release,
			previous,
			restore,
			predecessor: chain?.plan.id ?? null,
			signoff: digestSignoff(chain),
			parity: parity.digest,
			manifest,
			item: this.context.config.item,
			createdAt: Date.now()
		};
		return { plan, parity, source: chosenSource(input, restore) };
	}

	async inventory(manifest: string): Promise<Partial<Record<Environment, Observation>>> {
		const samples = await Promise.all(
			environments.flatMap((env) => {
				const target = this.context.config.targets[env];
				if (!target) return [];
				return [
					this.broker.inspect(this.context.project, env, manifest).then((sample) => {
						assertObservation(target.id, sample);
						return [env, sample] as const;
					})
				];
			})
		);
		return Object.fromEntries(samples);
	}

	predecessor(
		input: DeployRequest,
		live: Partial<Record<Environment, Observation>>
	): Journal | null {
		if (input.rollback || input.environment === 'staging') return null;
		const lower = input.environment === 'preprod' ? 'staging' : 'preprod';
		const observed = live[lower];
		if (!input.release || !input.from || !observed)
			throw new Error('An exact signed ' + lower + ' deployment is required.');
		const record = this.store.get(input.from);
		assertPredecessor(record, {
			project: this.context.project,
			environment: lower,
			release: input.release.id,
			observed
		});
		verifySignoff(record, record.signoff!, this.context.registry);
		return record;
	}

	private restoreTarget(id: string, current: Observation): Observation {
		const record = this.store.get(id);
		const { plan, result } = record;
		if (
			plan.project !== this.context.project ||
			!plan.release ||
			plan.target !== current.target ||
			!result ||
			!sameVersion(result.observed, current) ||
			current.version === plan.previous.version
		) {
			throw new Error('Rollback source does not match the currently routed release.');
		}
		assertTargetProfile(plan.previous.profile, current);
		return plan.previous;
	}
}

function assertPredecessor(
	record: Journal,
	expected: { project: string; environment: Environment; release: string; observed: Observation }
): void {
	const { plan, result, signoff } = record;
	if (
		plan.project !== expected.project ||
		plan.environment !== expected.environment ||
		plan.release?.id !== expected.release ||
		!result ||
		!signoff ||
		!sameVersion(result.observed, expected.observed)
	) {
		throw new Error('The signed predecessor is for another release or is no longer routed.');
	}
}

function digestSignoff(record: Journal | null): string | null {
	return record?.signoff ? hash(record.signoff) : null;
}
function chosenSource(input: DeployRequest, restore: Observation | null): string | null {
	return input.release?.source ?? input.source ?? restore?.source ?? null;
}
