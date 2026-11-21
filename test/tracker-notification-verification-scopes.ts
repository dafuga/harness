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
				'tick holds direct reminders through quiet hours, groups once, and repeats only active flags after retry':
					'reminders',
				'tick coalesces legacy webhook escalations after a block and closes them on answer':
					'reminders',
				'tick drops a held flag after answer and schedules the surviving flag at the next configured slot':
					'reminders'
			},
			'test/services/projects-sessions/tracker-attention-delivery.test.ts': {
				'pause and resume release one relevant Chief of Staff batch, with recurring agent wake-ups outside quiet hours':
					'attention',
				'tick keeps a delayed window out of quiet hours and retries the attention batch on the next window':
					'attention',
				'enqueue keeps only the latest unsent launch-wait text and drops waits with superseded tokens':
					'attention'
			}
		},
		playwright: {}
	}
};
