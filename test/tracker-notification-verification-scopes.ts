import type { VerificationScope } from './verification-targets.types';

export const trackerNotificationVerificationScopes: Record<string, VerificationScope> = {
	'tracker-notification-delivery': {
		package: 'root',
		vitest: {
			'test/services/projects-sessions/tracker-notification.test.ts': {
				'tick groups completion at one clock, snapshots local targets and retries only the rejected callback':
					'callbacks',
				'tick records distinct resolution clocks and stops callback retries after eight attempts':
					'callbacks',
				'tick replays the persisted request after an accepted send and a failed outcome commit':
					'callbacks'
			},
			'test/services/projects-sessions/tracker-webhook-delivery.test.ts': {
				'tick seeds its cursor and routes one stable owner batch while suppressing self changes and note-only changes':
					'outbox',
				'tick backs off rejected groups, joins new work on retry and discards superseded recurring wake-ups':
					'outbox',
				'tick on a spoke leaves queued webhook and reminder escalation work for the hub': 'outbox'
			},
			'test/services/projects-sessions/tracker-reminder-delivery.test.ts': {
				'tick sends overnight direct reminders, groups once, and repeats only active flags after retry':
					'reminders',
				'tick delivers the current explicit reminder once at its timestamp across restarts overnight':
					'reminders',
				'tick sends a scheduled reminder through a webhook when it is the only hub destination':
					'reminders',
				'tick coalesces legacy webhook escalations after a block and closes them on answer':
					'reminders',
				'tick sends overnight asks at once and schedules only the surviving flag at the next configured slot':
					'reminders'
			},
			'test/services/projects-sessions/tracker-attention-delivery.test.ts': {
				'pause and resume release one relevant Chief of Staff batch, with recurring agent wake-ups while paused':
					'attention',
				'tick sends an overnight ask to Chief of Staff and retries the batch on the next window':
					'attention',
				'enqueue keeps only the latest unsent launch-wait text and drops waits with superseded tokens':
					'attention'
			}
		},
		playwright: {}
	},
	'tracker-notification-storage': {
		package: 'root',
		vitest: {
			'test/repositories/projects-sessions/tracker-notification-queue.test.ts': {
				'startup preserves pinned notification rows, pause state and cursors through a legacy reopen':
					'startup',
				'tick keeps legacy retry eligibility and IDs and resume settles the existing CoS batch':
					'retry-and-resume',
				'tick replays the exact committed request after a receipt and a rolled-back acknowledgement':
					'receipt-replay',
				'startup refuses incompatible notification tables and rolls back the queue schema migration':
					'migration-rollback'
			}
		},
		playwright: {}
	}
};
