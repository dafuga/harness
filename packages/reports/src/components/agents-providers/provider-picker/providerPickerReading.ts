// @harness-uid u_yckomncarv
import type { ThrownValue } from '../../../helpers/strings/errorMessage.types';
import type {
	PickerModel,
	ProviderSelection
} from '../../../../../../src/core/development-tooling/pickerModelTypes';
import type {
	PickerSnapshot,
	SwitchRequest
} from '../../../../../../src/core/development-tooling/pickerTypes';

/** @pure A picker response is a snapshot when it names the default provider. */
export function isSnapshot(data: object | null): data is PickerSnapshot {
	return data !== null && 'defaultProvider' in data;
}

/** @pure The queued sessions of a list response, or null when it holds no list. */
export function readSessions(data: object | null): SwitchRequest[] | null {
	const list = (data as { sessions?: SwitchRequest[] } | null)?.sessions;
	return Array.isArray(list) ? list : null;
}

/** @pure The catalog label of a selection's model, or the model id when the catalog lacks it. */
export function selectionLabel(models: PickerModel[], target: ProviderSelection): string {
	const known = models.find(
		(item) => item.provider === target.provider && item.model === target.model
	);
	return known?.label ?? target.model;
}

/** @pure The message of a thrown error, or the fallback for any other thrown value. */
export function failureText(cause: ThrownValue, fallback: string): string {
	return cause instanceof Error ? cause.message : fallback;
}
