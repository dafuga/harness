import { ProjectContextValidator } from '../projects-sessions/ProjectContextValidator';
import { channels } from '../../models/development-tooling/DesktopBridge.types';
import { ipcPayload } from '../../utils/development-tooling/ipc-payload/ipcPayload';
export class IpcRequestValidator {
	parse(channel: string, input: unknown): unknown {
		if (!(Object.values(channels) as string[]).includes(channel))
			throw new Error('Unknown desktop operation.');
		const context = new ProjectContextValidator();
		const extended = context.operation(channel, input);
		if (extended !== undefined) return extended;
		const parsed = ipcPayload(channel, input);
		return parsed && typeof parsed === 'object' ? { ...parsed, ...context.context(input) } : parsed;
	}
}
