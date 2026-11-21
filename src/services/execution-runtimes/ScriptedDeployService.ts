// @harness-uid u_hknoug3rur
import { DeployBroker } from '../../core/execution-runtimes/scripted-deploy/broker';
import {
	hash,
	type Journal,
	type Plan,
	type Proof,
	type Release
} from '../../core/execution-runtimes/scripted-deploy/contracts';
import { assertResult, parityReport } from '../../core/execution-runtimes/scripted-deploy/parity';
import {
	verifyApproval,
	verifySignoff
} from '../../core/execution-runtimes/scripted-deploy/proofs';
import {
	buildRelease,
	verifyArtifact
} from '../../core/execution-runtimes/scripted-deploy/releaseFiles';
import { DeployRunRepository } from '../../repositories/execution-runtimes/DeployRunRepository';
import {
	manifestDigest,
	type DeployProject,
	type DeployRegistry
} from '../../validators/execution-runtimes/DeployManifestValidator';

import { DeployPlanning, type DeployRequest } from './scripted-deploy/DeployPlanning';

import { DeployRecovery } from './scripted-deploy/DeployRecovery';
import { DeployVerification } from './scripted-deploy/DeployVerification';

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
		this.verification = new DeployVerification(config, this.store, this.broker);
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

	async deploy(input: DeployRequest): Promise<Journal> {
		const { plan, parity } = await this.planning.plan(input);
		if (parity.blocked)
			throw new Error(
				'Deployment parity has unexpected differences. Run with --plan to view them.'
			);
		if (!plan.release && !plan.restore) throw new Error('Deployment requires a prepared release.');
		const artifact = await verifyPreparedArtifact(this.store, plan, this.config.image);
		const record: Journal = { plan, phase: 'pending' };
		this.store.lock(plan.project, plan.environment, plan.id);
		try {
			return await this.apply(record, artifact, input);
		} catch (error) {
			throw new Error(
				'Deployment run ' +
					plan.id +
					' stopped. ' +
					(error instanceof Error ? error.message : 'Operation failed.')
			);
		} finally {
			if (record.phase !== 'applying') this.store.unlock(record);
		}
	}

	async signoff(id: string, proof: Proof): Promise<Journal> {
		const record = this.store.get(id);
		if (record.plan.project !== this.project) throw new Error('Run belongs to another project.');
		if (record.signoff) throw new Error('A sign-off is already recorded for this run.');
		verifySignoff(record, proof, this.registry);
		await this.broker.note(
			record.plan.item,
			'Deploy sign-off ' + proof.payload.reference + ' for run ' + id
		);
		const signed = { ...record, signoff: proof };
		this.store.save(signed);
		return signed;
	}

	private async apply(
		record: Journal,
		artifact: string | null,
		input: DeployRequest
	): Promise<Journal> {
		const { plan } = record;
		this.store.save(record);
		const approval = await this.broker.authorize(plan);
		await this.revalidate(plan, approval, input);
		if (artifact) await verifyPreparedArtifact(this.store, plan, this.config.image);
		verifyApproval(plan, approval, this.registry);
		record.approval = approval;
		record.phase = 'applying';
		this.store.save(record);
		const result = await this.broker.apply(plan, approval, artifact);
		assertResult(plan, result.observed);
		record.result = result;
		record.phase = 'deployed';
		this.store.save(record);
		return await this.verification.verify(record);
	}

	private async revalidate(plan: Plan, approval: Proof, input: DeployRequest): Promise<void> {
		verifyApproval(plan, approval, this.registry);
		const current = await this.planning.inventory(plan.manifest);
		const parity = parityReport(
			this.config,
			current,
			plan.release ? { release: plan.release, target: plan.environment } : undefined
		);
		if (
			parity.blocked ||
			parity.digest !== plan.parity ||
			manifestDigest(this.config) !== plan.manifest
		) {
			throw new Error('Provider state or deploy scripts changed after planning.');
		}
		this.planning.predecessor(input, current);
		await this.broker.note(
			plan.item,
			'Deploy approval ' +
				approval.payload.reference +
				' for ' +
				plan.action +
				' run ' +
				plan.id +
				', target ' +
				plan.target +
				', plan ' +
				hash(plan)
		);
		verifyApproval(plan, approval, this.registry);
	}
}

async function verifyPreparedArtifact(
	store: DeployRunRepository,
	plan: Plan,
	image: string
): Promise<string | null> {
	const value = plan.release;
	if (!value) return null;
	if (value.project !== plan.project || value.manifest !== plan.manifest || value.image !== image) {
		throw new Error('Prepared artifact belongs to another project, manifest, or toolchain.');
	}
	return verifyArtifact(store, value);
}
