import {
	assertObservation,
	assertResult,
	sameVersion
} from '../../../core/execution-runtimes/scripted-deploy/parity';
import type { DeployBroker } from '../../../core/execution-runtimes/scripted-deploy/broker';
import type { Journal } from '../../../core/execution-runtimes/scripted-deploy/contracts';
import type { DeployRunRepository } from '../../../repositories/execution-runtimes/DeployRunRepository';
import type { DeployVerification } from './DeployVerification';

export class DeployRecovery {
	constructor(
		private readonly store: DeployRunRepository,
		private readonly broker: DeployBroker,
		private readonly verify: DeployVerification
	) {}

	async resume(id: string): Promise<Journal> {
		const record = this.store.get(id);
		const { project, environment } = record.plan;
		if (record.phase === 'pending')
			throw new Error('No provider mutation has been submitted for this run.');
		const active = this.store.active(project, environment);
		if (active && active !== id) throw new Error('Another run has claimed the deployment target.');
		if (!active) this.store.lock(project, environment, id);
		try {
			if (record.phase === 'applying') await this.reconcile(record);
			return await this.finish(record);
		} finally {
			if (record.phase !== 'applying' && this.store.active(project, environment) === id) {
				this.store.unlock(record);
			}
		}
	}

	private async reconcile(record: Journal): Promise<void> {
		const { plan } = record;
		const result = await this.broker.reconcile(plan);
		if (result.status === 'pending')
			throw new Error('Provider operation is still unresolved. The claim remains held.');
		if (result.status === 'not-applied') {
			assertObservation(plan.target, result.observed);
			if (!sameVersion(plan.previous, result.observed))
				throw new Error('Provider could not reconcile the previous target.');
			record.phase = 'not-applied';
		} else {
			assertResult(plan, result.result.observed);
			record.result = result.result;
			record.phase = 'deployed';
		}
		this.store.save(record);
	}

	private async finish(record: Journal): Promise<Journal> {
		if (record.phase === 'not-applied' || record.phase === 'complete') return record;
		const { plan, result } = record;
		if (!result) throw new Error('Provider operation has no deployment receipt.');
		const current = await this.broker.inspect(plan.project, plan.environment, plan.manifest);
		assertObservation(plan.target, current);
		if (!sameVersion(current, result.observed))
			throw new Error('Current target differs from the interrupted deployment.');
		return this.verify.verify(record);
	}
}
