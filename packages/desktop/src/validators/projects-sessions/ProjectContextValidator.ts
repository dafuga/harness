// @harness-uid u_cx6ay75f2w
import { ipcFields, textField, commitPattern } from '../../utils/ipc-payload/ipcFields';
import { threadPayload } from '../../utils/ipc-payload/ipcPayload';
import { ExplicitProjectRequiredError } from './ProjectContextValidator.types';
const projectPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const canvasPattern = /^[a-z0-9][a-z0-9-]*$/;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export class ProjectContextValidator {
	operation(channel: string, input: unknown): unknown {
		if (['project:list', 'hosted:status', 'hosted:connect', 'hosted:disconnect'].includes(channel))
			return null;
		if (channel === 'project:select') {
			const parsed = this.context(input);
			if (!parsed.projectId) throw new ExplicitProjectRequiredError('Select an explicit project.');
			return parsed;
		}
		if (channel === 'thread:comment') return this.comment(input);
		if (channel === 'design:canvases') return this.canvas(input);
		if (['thread:pending', 'project:capabilities', 'project:agents'].includes(channel))
			return this.context(input ?? {});

		return undefined;
	}
	canvas(input: unknown) {
		const value = ipcFields(input);
		const canvas = value.canvas === null ? null : textField(value.canvas, 64, canvasPattern);
		return { ...this.context(value), canvas };
	}
	context(input: unknown): { projectId?: string } {
		const value = ipcFields(input);
		return value.projectId === undefined
			? {}
			: { projectId: textField(value.projectId, 128, projectPattern) };
	}
	comment(input: unknown) {
		const value = ipcFields(input),
			anchor = ipcFields(value.anchor);
		return {
			...this.context(value),
			requestId: textField(value.requestId, 36, uuidPattern),
			...(value.threadId === undefined
				? {}
				: { threadId: textField(value.threadId, 36, uuidPattern) }),
			anchor: {
				...threadPayload(anchor),
				branch: textField(anchor.branch, 255),
				commit: textField(anchor.commit, 40, commitPattern)
			},
			text: textField(value.text, 20000)
		};
	}
}
