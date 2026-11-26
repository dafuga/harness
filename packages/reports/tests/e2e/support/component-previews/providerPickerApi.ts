import type { Route } from '@playwright/test';
import { picker } from './shared';

/** Answer the picker's real preview protocol with a controlled session observation. */
export async function pickerFixture(route: Route) {
	const page = route.request().frame().page();
	const variant = new URL(page.url()).searchParams.get('variant') ?? '';
	const { name } = route.request().postDataJSON() as { name: string };
	const held: Record<string, string> = {
		loading: 'open_model_picker',
		refreshing: 'get_provider_status',
		binding: 'get_provider_status',
		queueing: 'request_model_switch',
		cancelling: 'cancel_model_switch',
		'loading-queue': 'list_observed_sessions'
	};
	if (held[variant] === name) {
		await new Promise<void>((resolve) => page.once('close', () => resolve()));
		return;
	}
	if (variant === 'connection-error' && name === 'open_model_picker')
		return route.fulfill({ status: 503, json: { error: 'Picker unavailable.' } });
	if (name === 'list_observed_sessions')
		return route.fulfill({
			json: {
				sessions: observedSessions(variant)
			}
		});
	if (name === 'cancel_model_switch') return route.fulfill({ json: { ...picker, request: null } });
	return route.fulfill({ json: pickerSnapshot(variant) });
}

function observedSessions(variant: string) {
	if (variant === 'queue-error') return null;
	return variant === 'queue-empty' ? [] : [picker.request];
}

function pickerSnapshot(variant: string) {
	if (['unbound', 'bind-ready', 'binding'].includes(variant))
		return { ...picker, sessionId: null, active: null, request: null };
	if (variant === 'unobserved') return { ...picker, active: null, request: null };
	if (['queue-empty', 'queueing'].includes(variant)) return { ...picker, request: null };
	if (variant === 'no-models') return { ...picker, models: [], active: null, request: null };
	if (variant === 'in-use')
		return { ...picker, active: { ...picker.active, idle: false, clients: 2 } };
	if (variant === 'control-unavailable')
		return {
			...picker,
			controlConnected: false,
			message: 'Desktop control is unavailable; the request stays pending.'
		};
	return requestSnapshot(variant);
}

function requestSnapshot(variant: string) {
	const status = variant === 'request-cancelled' ? 'cancelled' : variant;
	if (!['applying', 'applied', 'failed', 'cancelled'].includes(status) || variant === 'cancelled')
		return picker;
	return {
		...picker,
		active:
			status === 'applied' ? { ...picker.active, selection: picker.request.target } : picker.active,
		request: {
			...picker.request,
			status,
			reason: status === 'failed' ? 'The session could not be resumed.' : ''
		}
	};
}
