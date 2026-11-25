// @harness-uid u_v7jkpzcx3c
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import { z } from 'zod';
import { DeployDockerAdapter } from '../../../adapters/execution-runtimes/DeployDockerAdapter';
import { smoke, type Journal } from '../../../core/execution-runtimes/scripted-deploy/contracts';
import type { DeployBroker } from '../../../core/execution-runtimes/scripted-deploy/broker';
import type { DeployRunRepository } from '../../../repositories/execution-runtimes/DeployRunRepository';
import type { DeployProject } from '../../../validators/execution-runtimes/DeployManifestValidator';

const cleanupResult = z.strictObject({ cleaned: z.literal(true) });

export class DeployVerification {
	private readonly docker: DeployDockerAdapter;
	constructor(
		private readonly config: DeployProject,
		private readonly store: DeployRunRepository,
		private readonly broker: DeployBroker,
		private readonly progress: (record: Journal) => Promise<void>
	) {
		this.docker = new DeployDockerAdapter({ project: config });
	}

	async verify(record: Journal): Promise<Journal> {
		const { plan } = record;
		const route: string = this.route(record);
		const observed = record.result!.observed;
		const passed = smoke.parse(await this.docker.run('smoke', {}, { route, observed }));
		if (
			passed.version !== observed.version ||
			passed.source !== observed.source ||
			passed.artifact !== observed.artifact
		) {
			throw new ExpectedCliError('Routed smoke returned a different release.');
		}
		record.smoke = passed;
		record.phase = 'verified';
		this.store.save(record);
		await this.progress(record);
		await this.cleanup(record, route);
		await this.broker.note(
			plan.item,
			'Verified ' +
				plan.action +
				' run ' +
				plan.id +
				', target ' +
				plan.target +
				', provider operation ' +
				record.result!.operation +
				', artifact ' +
				(observed.artifact ?? 'unrecorded legacy') +
				'.'
		);
		await this.progress(record);
		return record;
	}

	async cleanup(record: Journal, route: string = this.route(record)): Promise<void> {
		const { plan } = record;
		try {
			cleanupResult.parse(await this.docker.run('cleanup', {}, { run: plan.id, route }));
		} catch {
			record.phase = 'cleanup-failed';
			this.store.save(record);
			throw new ExpectedCliError('Route smoke passed and task cleanup needs reconciliation.');
		}
		record.phase = 'complete';
		this.store.save(record);
	}

	private route(record: Journal): string {
		const target = this.config.targets[record.plan.environment];
		if (!target) throw new ExpectedCliError('Run target is no longer in the deploy manifest.');
		return target.route;
	}
}
