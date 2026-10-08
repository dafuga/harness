import type { PickerModel, ProviderSelection } from './pickerModelTypes';

export interface SwitchRequest {
	id: string;
	sessionId: string;
	target: ProviderSelection;
	status: 'pending' | 'applying' | 'applied' | 'failed' | 'cancelled';
	createdAt: string;
	reason: string;
}

export interface SwitchStore {
	get(sessionId: string): SwitchRequest | null;
	put(record: SwitchRequest, expectedId: string | null): boolean;
	list(): SwitchRequest[];
}

export interface SessionObservation {
	selection: ProviderSelection;
	idle: boolean;
	clients: number;
	observedAt: string;
}

export interface SessionControl {
	inspect(sessionId: string): Promise<SessionObservation>;
	resume(sessionId: string, selection: ProviderSelection): Promise<void>;
}

export interface PickerSnapshot {
	sessionId: string | null;
	defaultProvider: 'openai';
	active: SessionObservation | null;
	request: SwitchRequest | null;
	models: PickerModel[];
	controlConnected: boolean;
	message: string;
}

export const desktopControlUnavailable =
	'Desktop control connection unavailable. Requests stay pending; no provider settings change.';

export function switchRevision(record: SwitchRequest | null): string | null {
	return record ? `${record.id}:${record.status}` : null;
}
