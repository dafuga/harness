import { randomUUID } from 'node:crypto';
import type { GatewayCall, GatewayItem } from '../utils/gatewayTypes';

export class CodexResponsesSerializer {
	private readonly id = `resp_${randomUUID()}`;
	private readonly output: GatewayItem[] = [];
	private sequence = 0;
	private message?: GatewayItem;
	private textValue = '';

	constructor(private readonly model: string) {}

	private event(type: string, fields: GatewayItem = {}): GatewayItem {
		return { type, sequence_number: this.sequence++, ...fields };
	}

	private response(status: string): GatewayItem {
		return {
			id: this.id,
			object: 'response',
			created_at: Math.floor(Date.now() / 1000),
			model: this.model,
			status,
			output: this.output,
			parallel_tool_calls: true,
			error: null,
			incomplete_details: null
		};
	}

	start(): GatewayItem[] {
		return ['response.created', 'response.in_progress'].map((type) =>
			this.event(type, { response: this.response('in_progress') })
		);
	}

	text(delta: string): GatewayItem[] {
		const events: GatewayItem[] = [];
		if (!this.message) {
			this.message = createMessage();
			this.output.push(this.message);
			events.push(
				this.event('response.output_item.added', {
					output_index: this.output.length - 1,
					item: { ...this.message }
				})
			);
			events.push(
				this.event('response.content_part.added', {
					item_id: this.message.id,
					output_index: this.output.length - 1,
					content_index: 0,
					part: { type: 'output_text', text: '', annotations: [] }
				})
			);
		}
		this.textValue += delta;
		events.push(
			this.event('response.output_text.delta', {
				item_id: this.message.id,
				output_index: this.output.indexOf(this.message),
				content_index: 0,
				delta
			})
		);
		return events;
	}

	call(call: GatewayCall): GatewayItem[] {
		const item: GatewayItem = {
			id: `fc_${randomUUID()}`,
			type: 'function_call',
			call_id: call.id,
			name: call.name,
			arguments: call.arguments,
			status: 'completed'
		};
		if (call.custom)
			Object.assign(item, { type: 'custom_tool_call', input: JSON.parse(call.arguments).input });
		const index = this.output.length;
		this.output.push(item);
		return [
			this.event('response.output_item.added', { output_index: index, item }),
			this.event('response.output_item.done', { output_index: index, item })
		];
	}

	finish(): GatewayItem[] {
		const events: GatewayItem[] = [];
		if (this.message) {
			const part = { type: 'output_text', text: this.textValue, annotations: [] };
			Object.assign(this.message, { status: 'completed', content: [part] });
			const fields = {
				item_id: this.message.id,
				output_index: this.output.indexOf(this.message),
				content_index: 0
			};
			events.push(
				this.event('response.output_text.done', { ...fields, text: this.textValue }),
				this.event('response.content_part.done', { ...fields, part }),
				this.event('response.output_item.done', {
					output_index: fields.output_index,
					item: this.message
				})
			);
		}
		events.push(this.event('response.completed', { response: this.response('completed') }));
		return events;
	}

	fail(message: string): GatewayItem[] {
		return [
			this.event('response.failed', {
				response: { ...this.response('failed'), error: { code: 'gateway_error', message } }
			})
		];
	}
}

function createMessage(): GatewayItem {
	return {
		id: `msg_${randomUUID()}`,
		type: 'message',
		role: 'assistant',
		status: 'in_progress',
		content: []
	};
}
