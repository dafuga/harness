// @harness-uid u_rzpjc6wqqy
import type {
	TrackerAttemptVersion,
	TrackerDispatchEvent,
	TrackerDispatchPolicy,
	TrackerDispatchResult,
	TrackerDispatchSnapshot,
	TrackerDispatchStore,
	TrackerDueGrant,
	TrackerLaunchRequest
} from './TrackerDispatcherService.types';
import { canonicalNode, skip } from './tracker-dispatcher-service/launchEligibility';
import { requestLaunch } from './tracker-dispatcher-service/launchIntent';
import { claimLaunch, prepareRetry } from './tracker-dispatcher-service/runClaim';
import { transitionRun } from './tracker-dispatcher-service/runTransition';
import { creditHumanRedo, rejectCompletion } from './tracker-dispatcher-service/runReview';

/** Plan launches and record observed runner activity through one atomic store boundary. */
export class TrackerDispatcherService {
	constructor(
		private readonly store: TrackerDispatchStore,
		private readonly policy: TrackerDispatchPolicy
	) {}

	request(itemId: string, request: TrackerLaunchRequest): Promise<TrackerDispatchResult> {
		return this.store.update(itemId, (snapshot) =>
			requestLaunch(snapshot, request, this.policy, this.policy.now())
		);
	}

	claim(itemId: string, token: string, grant?: TrackerDueGrant): Promise<TrackerDispatchResult> {
		return this.store.update(itemId, (snapshot) =>
			claimLaunch(snapshot, { token, grant }, this.policy, this.policy.now())
		);
	}

	prepare(
		itemId: string,
		attempt: TrackerAttemptVersion,
		grant?: TrackerDueGrant
	): Promise<TrackerDispatchResult> {
		return this.store.update(itemId, (snapshot) => {
			const run = this.currentRun(snapshot, attempt);
			if (!run) return skip('ignored', 'attempt changed or is not owned by this computer');
			return prepareRetry(snapshot, { run, grant }, this.policy, this.policy.now());
		});
	}

	record(
		itemId: string,
		attempt: TrackerAttemptVersion,
		event: TrackerDispatchEvent
	): Promise<TrackerDispatchResult> {
		return this.store.update(itemId, (snapshot) => {
			const run = this.currentRun(snapshot, attempt);
			if (!run) return skip('ignored', 'attempt changed or is not owned by this computer');
			return transitionRun(snapshot, run, event, { policy: this.policy, now: this.policy.now() });
		});
	}

	reject(itemId: string, reason: string): Promise<TrackerDispatchResult> {
		return this.store.update(itemId, (snapshot) =>
			rejectCompletion(snapshot, reason, { policy: this.policy, now: this.policy.now() })
		);
	}

	creditHumanRedo(itemId: string, runIds: readonly number[]): Promise<TrackerDispatchResult> {
		return this.store.update(itemId, (snapshot) =>
			creditHumanRedo(snapshot, runIds, { policy: this.policy, now: this.policy.now() })
		);
	}

	private currentRun({ runs }: TrackerDispatchSnapshot, { id, revision }: TrackerAttemptVersion) {
		if (revision < 0) return undefined;
		const node = canonicalNode(this.policy.node, this.policy);
		return runs.find((run) => run.node === node && run.id === id && run.revision === revision);
	}
}

export type {
	TrackerAttemptVersion,
	TrackerDispatchDecision,
	TrackerDispatchEvent,
	TrackerDispatchItem,
	TrackerDispatchPolicy,
	TrackerDispatchResult,
	TrackerDispatchSnapshot,
	TrackerDispatchStore,
	TrackerDispatchWrites,
	TrackerDueGrant,
	TrackerDuePolicy,
	TrackerLaunchIntent,
	TrackerLaunchOptions,
	TrackerLaunchPick,
	TrackerLaunchRequest,
	TrackerLaunchRung,
	TrackerRunReceipt,
	TrackerSessionEvidence
} from './TrackerDispatcherService.types';
