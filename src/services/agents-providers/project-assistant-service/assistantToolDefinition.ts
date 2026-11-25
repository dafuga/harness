// @harness-uid u_kg5hqj5fgh
import type {
	AssistantToolDefinition,
	AssistantToolResult
} from '../../../core/agents-providers/projectAssistant.types';
import type { ToolInput, ToolShape } from './assistantTool.types';

/** Build a tool definition from a compact shape and its handler. */
export function assistantToolDefinition(
	name: string,
	description: string,
	shape: ToolShape,
	run: (input: ToolInput) => Promise<AssistantToolResult>
): AssistantToolDefinition {
	const properties = Object.fromEntries(
		Object.entries(shape.fields).map(([key, type]) => [
			key,
			type.includes('|') ? { type: 'string', enum: type.split('|') } : { type }
		])
	);
	return {
		name,
		description,
		input: { type: 'object', properties, required: shape.required ?? [] },
		write: shape.write ?? false,
		run
	};
}
