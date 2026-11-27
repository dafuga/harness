import type { VerificationScope } from './verification-targets';

export const trackerDispatcherVerificationScopes: Record<string, VerificationScope> = {
	'tracker-dispatcher': {
		package: 'root',
		vitest: {
			'test/services/agents-providers/tracker-dispatcher.test.ts': {
				'manual requests normalize aliases, keep the token on replay and reject changed options':
					'manual-claims',
				'explicit intent validates custom names and preserves the offline fallback on auto placement':
					'manual-claims',
				'concurrent claimants commit one reservation; a peer claim still fences a stale replica':
					'manual-claims'
			},
			'test/services/agents-providers/tracker-dispatcher-due.test.ts': {
				'due intent uses a local-zone date, holds future or ineligible work and keeps the scheduled selection':
					'due-policy',
				'a reachable denial beats local fallback, while a sole owner can start during an outage':
					'due-policy',
				'due claim rechecks policy, item and admission even after receiving a grant': 'due-policy',
				'adapter due ownership applies even when regular due scheduling is disabled': 'due-policy',
				'the hub paces due reservations across items and can claim at the exact interval':
					'due-policy'
			},
			'test/services/agents-providers/tracker-dispatcher-lifecycle.test.ts': {
				'a restarted dispatcher adopts a proven reservation and fences an unrelated session':
					'reservation-recovery',
				'an observed exit can recover a session that started and finished before adoption':
					'reservation-recovery',
				'claim and retry results are released only after the receipt transaction commits':
					'reservation-recovery',
				'startup retries keep the rung and exhaust atomically when start keeps failing':
					'reservation-recovery',
				'invalid model selections persist an abandoned claim and a block without reserving a runner':
					'reservation-recovery'
			},
			'test/services/agents-providers/tracker-dispatcher-outcomes.test.ts': {
				'a reopened item invalidates the previous verification result and records usage when verification passes':
					'run-outcomes',
				'verification failure reopens the item and escalates; the eventual success credits the retry':
					'run-outcomes',
				'a current answer revives only its original live session and preserves the run identity':
					'run-outcomes',
				'pending human review suppresses an ETA timeout until the hard cap, while a deleted item abandons':
					'run-outcomes',
				'missing items preserve active sessions until recovery; closing the linked source abandons cleanly':
					'run-outcomes',
				'a pinned model stays pinned when a completed result is rejected': 'run-outcomes'
			},
			'test/services/agents-providers/tracker-dispatcher-review.test.ts': {
				'a failed verification or rejection reopens the item even when no retry follows':
					'run-outcomes'
			}
		},
		playwright: {}
	}
};
