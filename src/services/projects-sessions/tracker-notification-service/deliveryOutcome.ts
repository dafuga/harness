// @harness-uid u_vqnqshfas2
import type {
	TrackerDeliveryResult,
	TrackerNotificationOptions
} from '../TrackerNotificationService.types';
import type { DeliveryAttempt } from './notificationState.types';

/** Send a copy of the issued request; a thrown send is a failed attempt, not a failed tick. */
export async function sendOutcome(
	options: TrackerNotificationOptions,
	attempt: DeliveryAttempt
): Promise<TrackerDeliveryResult> {
	const { destinations } = options;
	const { request } = attempt;
	try {
		return await destinations.send(globalThis.structuredClone(request));
	} catch (error) {
		return { status: 'rejected', error: deliveryDiagnostic(error) };
	}
}

/** A busy target is an expected wait, so only real failures are logged. */
export function logFailure(
	options: TrackerNotificationOptions,
	attempt: DeliveryAttempt,
	result: TrackerDeliveryResult
): void {
	const { log } = options;
	const { kind, request } = attempt;
	if (result.status === 'rejected' && !result.busy)
		log?.(
			`tracker: ${kind} delivery to ${request.destination.id} failed: ${result.error.slice(0, 200)}`
		);
}

/**
 * What may be stored and logged about a thrown send. Error messages can carry
 * targets or credentials, so only an adapter-vetted diagnostic, a system error
 * code or the error name is kept.
 */
function deliveryDiagnostic(error: unknown): string {
	if (!(error instanceof Error)) return 'unknown delivery failure';
	if ('diagnostic' in error && typeof error.diagnostic === 'string') return error.diagnostic;
	const { code } = (error.cause ?? error) as { code?: unknown };
	return typeof code === 'string' ? code : error.name;
}
