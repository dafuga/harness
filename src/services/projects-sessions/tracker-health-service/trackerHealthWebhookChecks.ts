// @harness-uid u_jmy2diemrg
import type { TrackerHealthCheck, TrackerHealthStatus } from '../TrackerHealthService.types';
import type { TrackerHealthState } from './trackerHealthState.types';

export function trackerHealthWebhookChecks(
	status: TrackerHealthStatus,
	state: TrackerHealthState
): TrackerHealthCheck[] {
	const { webhook } = status;
	if (!webhook?.sender)
		return [
			{ name: 'webhook', ok: false, severity: 'info', detail: 'webhook sender is not enabled' }
		];
	const problems = webhookProblems(webhook, state.webhook_failed);
	const check: TrackerHealthCheck = {
		name: 'webhook',
		ok: problems.length === 0,
		severity: 'fail',
		detail: problems.join('; ') || 'ok'
	};
	if (!webhook.paused) return [check];
	const detail = 'webhook is paused; Chief of Staff events are held';
	return [check, { name: 'webhook_paused', ok: false, severity: 'info', detail }];
}

function webhookProblems(
	webhook: NonNullable<TrackerHealthStatus['webhook']>,
	baseline: number | undefined
): string[] {
	const failed = webhook.outbox?.failed ?? 0;
	const givenUp = baseline === undefined ? 0 : Math.max(0, failed - baseline);
	const unready = (webhook.routes ?? []).filter(({ ready }) => !ready).map(({ name }) => name);
	return [
		webhook.configured ? '' : 'webhook destination is not available',
		webhook.stuck ? `${webhook.stuck} event(s) failing for over 60 min` : '',
		givenUp ? `${givenUp} event(s) given up since the last check` : '',
		unready.length ? `route(s) not ready: ${unready.join(', ')}` : ''
	].filter(Boolean);
}
