import type { ProviderSelection } from './pickerModelTypes.types';

export function sameSelection(a: ProviderSelection, b: ProviderSelection): boolean {
	return a.provider === b.provider && a.model === b.model && a.effort === b.effort;
}

export function validateSessionId(value: string): string {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value))
		throw new Error('A valid explicit Codex session ID is required.');
	return value;
}

export type { ProviderSelection, PickerModel } from './pickerModelTypes.types';
