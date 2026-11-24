import type { VerificationScope } from './verification-targets.types';

export const trackerSupervisorVerificationScopes: Record<string, VerificationScope> = {
	'tracker-supervised-workers': {
		package: 'root',
		vitest: {
			'test/services/projects-sessions/tracker-host-watchdog.test.ts': {
				'journals one idle nudge, escalates a stale pane and forwards its alert once to the primary CoS':
					'session-health',
				'retains the legacy MB2 observed row while its pane is live and closes it without a provider launch':
					'session-health'
			},
			'test/services/projects-sessions/tracker-session-health.test.ts': {
				'holds recovery for a late live pane and reports a stranded launch and an orphan':
					'session-health'
			},
			'test/services/projects-sessions/tracker-watchdog-context.test.ts': {
				'samples active provider context at the exact pane directory and rejects ambiguity':
					'context-handoff',
				'requests a handoff once and closes only the idle owned attempt after its note':
					'context-handoff'
			},
			'test/services/projects-sessions/tracker-supervisor.test.ts': {
				'reports node status and waits for in-flight work after cancellation': 'worker-lifecycle'
			},
			'test/services/projects-sessions/tracker-dispatch-scheduler.test.ts': {
				'adopts an uncertain start after restart without releasing the attempt twice':
					'managed-adoption'
			},
			'test/services/projects-sessions/tracker-recurring.test.ts': {
				'commits catch-up history with a recoverable stable wake after a queue failure':
					'wake-recovery',
				'adopts a job result after losing the reply and wakes the owner once': 'job-receipt'
			}
		},
		playwright: {}
	}
};
