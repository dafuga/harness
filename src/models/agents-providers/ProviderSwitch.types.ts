// @harness-uid u_oetonmyf76
import type { SwitchRequest } from '../../core/development-tooling/pickerTypes';
export interface ProviderSwitchAttributes {
	session: string;
	id: string;
	data: SwitchRequest;
}
export type ProviderSwitchCreateInput = ProviderSwitchAttributes;
export type ProviderSwitchUpdateInput = Partial<Omit<ProviderSwitchAttributes, 'session'>>;
