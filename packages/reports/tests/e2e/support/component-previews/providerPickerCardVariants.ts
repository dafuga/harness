import type { SessionObservation, SwitchRequest } from '../../../../../../src/core/pickerTypes';
import type { PreviewCases } from './shared';

/** Vary the observed session and queued switch without changing the picker protocol. */
export function providerPickerCardVariant(props: PreviewCases[string], variant: string) {
	const active = props.active as SessionObservation;
	const request = props.request as SwitchRequest;
	if (variant === 'unknown') return { ...props, active: null, request: null };
	if (variant === 'in-use') return { ...props, active: { ...active, idle: false, clients: 2 } };
	if (variant === 'locked') return { ...props, locked: true };
	if (!['applying', 'applied', 'failed', 'cancelled'].includes(variant)) return null;
	return {
		...props,
		active: variant === 'applied' ? { ...active, selection: request.target } : active,
		request: {
			...request,
			status: variant,
			reason: variant === 'failed' ? 'The session could not be resumed.' : ''
		}
	};
}
