// @harness-uid u_kg5hqa3yza
import type {
	QaLabelEvent,
	QaThreadOutcome,
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
		const verdict = await this.eligibility.evaluate(event.issue);
		if (!verdict.eligible) return { status: 'skipped', reason: verdict.reason };
		const { task } = verdict;
		const steps = await this.ports.writeSteps(task);
		if (steps.length === 0) return { status: 'skipped', reason: 'no-runbook-steps' };
		const videoPath = await this.ports.record(task, steps);
		if ((await this.ledger.reserve(event.eventId, event.issue)) === 'duplicate')
			return { status: 'skipped', reason: 'duplicate' };
		try {
			const parent = qaParentText(
				task,
				this.environment.stagingUrl,
				this.environment.stagingBranch
			);
			const posted = await this.ports.post({ parent, steps: qaStepsText(steps), videoPath });
			await this.ledger.recordPost(event.eventId, event.issue, posted.channelId, posted.parentTs);
			await this.ports
				.linkBack(task, `slack:${posted.channelId}/${posted.parentTs}`)
				.catch(() => undefined);
			return { status: 'posted', ...posted };
		} catch {
			return { status: 'unknown', reason: 'post-failed-after-reservation' };
		}
	}
}
