import { z } from 'zod';
import type { GatewayRequest } from '../utils/gatewayTypes';

const schema = z.object({
	model: z.literal('claude-opus-5-5'),
	stream: z.literal(true),
	input: z.array(z.record(z.string(), z.unknown())),
	tools: z.array(z.record(z.string(), z.unknown())).default([]),
	instructions: z.string().optional(),
	previous_response_id: z.never().optional()
});

export class CodexRequestValidator {
	parse(value: unknown): GatewayRequest {
		return schema.parse(value);
	}
}
