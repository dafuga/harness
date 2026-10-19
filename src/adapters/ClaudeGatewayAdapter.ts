import type { GatewayRequest, GatewaySession } from '../utils/gatewayTypes';
import type { CodexSessionRepository } from '../repositories/CodexSessionRepository';
import { GatewayContentSerializer } from '../serializers/GatewayContentSerializer';
import { ClaudeQueryService } from '../services/ClaudeQueryService';

export class ClaudeGatewayAdapter {
	constructor(private readonly repository: CodexSessionRepository) {}

	validate(request: GatewayRequest, session: GatewaySession): void {
		new GatewayContentSerializer().history(request.input);
		if (!session.running) {
			if (
				['function_call_output', 'custom_tool_call_output'].includes(
					String(request.input.at(-1)?.type)
				)
			)
				throw new Error('No active query owns this continuation');
			return;
		}
		const outputs = request.input.filter(
			(item) =>
				['function_call_output', 'custom_tool_call_output'].includes(String(item.type)) &&
				session.pending.has(String(item.call_id))
		);
		if (new Set(outputs.map((item) => item.call_id)).size !== outputs.length)
			throw new Error('Duplicate tool outputs');
		if (!outputs.length || outputs.length !== session.pending.size)
			throw new Error('All pending tool results are required');
	}

	start(request: GatewayRequest, session: GatewaySession): void {
		this.validate(request, session);
		const outputs = request.input.filter(
			(item) =>
				['function_call_output', 'custom_tool_call_output'].includes(String(item.type)) &&
				session.pending.has(String(item.call_id))
		);
		if (session.running) {
			this.repository.deliver(session, outputs);
		} else {
			void new ClaudeQueryService(this.repository).run(request, session);
		}
	}
}
