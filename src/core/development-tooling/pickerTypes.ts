import type { SwitchRequest } from './pickerTypes.types';

export const desktopControlUnavailable =
	'Desktop control connection unavailable. Requests stay pending; no provider settings change.';

export function switchRevision(record: SwitchRequest | null): string | null {
	return record ? `${record.id}:${record.status}` : null;
}

export type {
	SwitchRequest,
	SwitchStore,
	SessionObservation,
	SessionControl,
	PickerSnapshot
} from './pickerTypes.types';
