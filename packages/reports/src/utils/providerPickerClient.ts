export interface PickerClient {
	preview: boolean;
	call(name: string, args?: Record<string, unknown>): Promise<unknown>;
	close(): Promise<void>;
}

export { providerPickerClient } from '../components/provider-picker/providerPickerClient';
