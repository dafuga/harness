import type { Route } from '@playwright/test';
import { picker } from './shared';

/** Answer the picker's real preview protocol with a controlled session observation. */
export async function pickerFixture(route: Route) {
	const page = route.request().frame().page();
	const variant = new URL(page.url()).searchParams.get('variant') ?? '';
	const { name } = route.request().postDataJSON() as { name: string };
	if (
		(variant === 'loading' && name === 'open_model_picker') ||
		(variant === 'refreshing' && name === 'get_provider_status')
	) {
		await new Promise<void>((resolve) => page.once('close', () => resolve()));
		return;
	}
	if (variant === 'connection-error' && name === 'open_model_picker')
		return route.fulfill({ status: 503, json: { error: 'Picker unavailable.' } });
	if (name === 'list_observed_sessions')
		return route.fulfill({
			json: {
				sessions:
					variant === 'queue-error' ? null : variant === 'queue-empty' ? [] : [picker.request]
			}
		});
	if (name === 'cancel_model_switch') return route.fulfill({ json: { ...picker, request: null } });
	return route.fulfill({ json: pickerSnapshot(variant) });
}

function pickerSnapshot(variant: string) {
	if (variant === 'unbound') return { ...picker, sessionId: null, active: null, request: null };
	if (variant === 'unobserved') return { ...picker, active: null, request: null };
	if (variant === 'queue-empty') return { ...picker, request: null };
	if (variant === 'control-unavailable')
		return {
			...picker,
			controlConnected: false,
			message: 'Desktop control is unavailable; the request stays pending.'
		};
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
