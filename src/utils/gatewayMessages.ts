import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { GatewayContentSerializer } from '../serializers/GatewayContentSerializer';
import type { GatewayRequest } from './gatewayTypes';
import { gatewayPrompt } from './gatewayPrompt';

export function gatewayMessages(request: GatewayRequest): AsyncGenerator<SDKUserMessage> {
	const { input, images } = new GatewayContentSerializer().history(request.input);
	return (async function* (): AsyncGenerator<SDKUserMessage> {
		yield {
			type: 'user',
			message: {
				role: 'user',
				content: [
					{
						type: 'text',
						text:
							gatewayPrompt({ ...request, input }) +
							'\nImage references are one-based indexes into the image blocks following this history.'
					},
					...images.map(({ data, mimeType }) => ({
						type: 'image' as const,
						source: { type: 'base64' as const, media_type: mimeType, data }
					}))
				]
			},
			parent_tool_use_id: null
		};
	})();
}
