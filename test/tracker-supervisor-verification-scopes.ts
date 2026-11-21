import type { VerificationScope } from './verification-targets.types';

export const trackerSupervisorVerificationScopes: Record<string, VerificationScope> = {
	'tracker-supervised-workers': {
		package: 'root',
		vitest: {
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
