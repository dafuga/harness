export interface PickerClient {
	preview: boolean;
	call(name: string, args?: Record<string, unknown>): Promise<unknown>;
	close(): Promise<void>;
}

export { providerPickerClient } from '../../components/agents-providers/provider-picker/providerPickerClient';
