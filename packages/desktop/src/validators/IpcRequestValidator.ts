import { channels } from '../models/DesktopBridge.types';
import { ipcPayload } from '../utils/ipcPayload';
export class IpcRequestValidator {
	parse(channel: string, input: unknown): unknown {
		if (!(Object.values(channels) as string[]).includes(channel))
			throw new Error('Unknown desktop operation.');
		return ipcPayload(channel, input);
	}
}
