import { ProjectContextValidator } from './ProjectContextValidator';
import { channels } from '../models/DesktopBridge.types';
import { ipcPayload } from '../utils/ipc-payload/ipcPayload';
import { gamePayload } from './gamePayload';
export class IpcRequestValidator {
	parse(channel: string, input: unknown): unknown {
		if (!(Object.values(channels) as string[]).includes(channel))
			throw new Error('Unknown desktop operation.');
		if (channel.startsWith('game:')) return gamePayload(channel, input);
		const context = new ProjectContextValidator();
		const extended = context.operation(channel, input);
		if (extended !== undefined) return extended;
		const parsed = ipcPayload(channel, input);
		return parsed && typeof parsed === 'object' ? { ...parsed, ...context.context(input) } : parsed;
	}
}
