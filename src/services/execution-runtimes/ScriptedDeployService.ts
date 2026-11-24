// @harness-uid u_hknoug3rur
import { ExpectedCliError } from '../../core/development-tooling/errors';
import { DeployBroker } from '../../core/execution-runtimes/scripted-deploy/broker';
import type {
	Journal,
	Proof,
	Release
} from '../../core/execution-runtimes/scripted-deploy/contracts';
import { buildRelease } from '../../core/execution-runtimes/scripted-deploy/releaseFiles';
import { DeployRunRepository } from '../../repositories/execution-runtimes/DeployRunRepository';
import {
	manifestDigest,
	type DeployProject,
	type DeployRegistry
} from '../../validators/execution-runtimes/DeployManifestValidator';

import { DeployPlanning, type DeployRequest } from './scripted-deploy/DeployPlanning';
import { DeployRecovery } from './scripted-deploy/DeployRecovery';
import { publishRunProgress } from './scripted-deploy/requestDeployApproval';
import { DeployVerification } from './scripted-deploy/DeployVerification';
import { publishSignoff, recordDeploySignoff } from './scripted-deploy/recordDeploySignoff';
import { runDeployPlan } from './scripted-deploy/runDeployPlan';

export class ScriptedDeployService {
	readonly store: DeployRunRepository;
	private readonly broker: DeployBroker;
	private readonly verification: DeployVerification;
	readonly recovery: DeployRecovery;
	readonly planning: DeployPlanning;

	constructor(
		private readonly registry: DeployRegistry,
		private readonly project: string,
		private readonly config: DeployProject
	) {
		this.store = new DeployRunRepository(registry.state);
		this.broker = new DeployBroker(registry, config);
		this.verification = new DeployVerification(config, this.store, this.broker, (record) =>
			publishRunProgress(this.registry, record)
		);
		this.recovery = new DeployRecovery(this.store, this.broker, this.verification);
		this.planning = new DeployPlanning({ config, project, registry }, this.store, this.broker);
	}

	prepare(source: string): Promise<Release> {
		return buildRelease(this.store, this.config, {
			project: this.project,
			source,
			manifest: manifestDigest(this.config)
		});
	}

	async deploy(input: DeployRequest, controlled = false): Promise<Journal> {
		if (
			!controlled &&
			input.environment === 'staging' &&
			this.registry.approvalInbox?.credentials[`${this.project}:staging`]
		)
			throw new ExpectedCliError('This staging target requires --wait-for-go.');
		return runDeployPlan(
			{
				registry: this.registry,
				config: this.config,
				store: this.store,
				broker: this.broker,
				planning: this.planning,
				verification: this.verification
			},
			input,
			controlled
		);
	}

	async resume(id: string): Promise<Journal> {
		try {
			return await this.recovery.resume(id);
		} finally {
			const record = this.store.get(id);
			await Promise.all([
				publishRunProgress(this.registry, record),
				publishSignoff(this.registry, record)
			]);
		}
	}

	signoff(id: string, proof: Proof, controlled = false): Promise<Journal> {
		return recordDeploySignoff(
			{
				registry: this.registry,
				store: this.store,
				broker: this.broker,
				project: this.project,
				config: this.config
			},
			id,
			proof,
			controlled
		);
	}
}
