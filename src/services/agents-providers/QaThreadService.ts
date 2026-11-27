// @harness-uid u_kg5hqa3yza
import type {
	QaLabelEvent,
	QaTask,
	QaThreadOutcome,
	QaThreadPost,
	QaThreadPorts
} from '../../core/agents-providers/qaThread.types';
import type { QaLedgerRepository } from '../../repositories/agents-providers/QaLedgerRepository';
import type { QaEligibilityService } from './QaEligibilityService';
import { qaParentText, qaStepsText } from './qa-thread-service/qaThreadText';

/** Label applied -> eligibility gate -> runbook -> recording -> ONE Slack thread, once per event. */
export class QaThreadService {
	constructor(
		private readonly eligibility: QaEligibilityService,
		private readonly ledger: QaLedgerRepository,
		private readonly ports: QaThreadPorts,
		private readonly environment: { stagingUrl: string; stagingBranch: string }
	) {}

	async handleLabel(event: QaLabelEvent): Promise<QaThreadOutcome> {
		if (await this.ledger.hasReservation(event.eventId, event.issue))
			return { status: 'skipped', reason: 'duplicate' };
		const verdict = await this.eligibility.evaluate(event.issue, event.deployedRevision);
		if (!verdict.eligible) return { status: 'skipped', reason: verdict.reason };
		const { task } = verdict;
		const steps = await this.ports.writeSteps(task);
		if (steps.length === 0) return { status: 'skipped', reason: 'no-runbook-steps' };
		const videoPath = await this.ports.record(task, steps, event.deployedRevision);
		if (this.ports.stillLive && !(await this.ports.stillLive(event)))
			return { status: 'skipped', reason: 'staging-changed' };
		if ((await this.ledger.reserve(event.eventId, event.issue)) === 'duplicate')
			return { status: 'skipped', reason: 'duplicate' };
		return this.publish(event, task, { steps: qaStepsText(steps), videoPath });
	}

	private async publish(
		event: QaLabelEvent,
		task: QaTask,
		evidence: Pick<QaThreadPost, 'steps' | 'videoPath'>
	): Promise<QaThreadOutcome> {
		try {
			const parent = qaParentText(
				task,
				this.environment.stagingUrl,
				this.environment.stagingBranch
			);
			const posted = await this.ports.post({ parent, ...evidence });
			await this.ledger.recordPost(event.eventId, event.issue, posted.channelId, posted.parentTs);
			const linked = await this.ports
				.linkBack(task, `slack:${posted.channelId}/${posted.parentTs}`)
				.then(
					() => true,
					() => false
				);
			return { status: 'posted', ...posted, ...(!linked && { linkBackFailed: true as const }) };
		} catch {
			return { status: 'unknown', reason: 'post-failed-after-reservation' };
		}
	}
}
