import type { SwitchRequest } from '../core/pickerTypes';
export interface ProviderSwitchAttributes {
	session: string;
	id: string;
	data: SwitchRequest;
}
export type ProviderSwitchCreateInput = ProviderSwitchAttributes;
export type ProviderSwitchUpdateInput = Partial<Omit<ProviderSwitchAttributes, 'session'>>;
