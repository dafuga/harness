import { z } from 'zod';
import type { ProviderSwitchService } from '../services/ProviderSwitchService';

export const pickerSessionSchema = z.object({ session_id: z.string().optional() }).strict();
export const pickerSwitchSchema = z
	.object({
		session_id: z.string(),
		provider: z.enum(['openai', 'harness-claude']),
		model: z.string(),
		effort: z.string()
	})
	.strict();
export const pickerCancelSchema = z
	.object({ session_id: z.string(), request_id: z.string() })
	.strict();

export async function pickerMcpTools(service: ProviderSwitchService, name: string, input: unknown) {
	if (name === 'list_models') return { models: await service.catalog.list() };
	if (name === 'list_observed_sessions') return { sessions: service.store.list() };
	if (name === 'request_model_switch') {
		const args = pickerSwitchSchema.parse(input);
		return service.request(args.session_id, {
			provider: args.provider,
			model: args.model,
			effort: args.effort
		});
	}
	if (name === 'cancel_model_switch') {
		const args = pickerCancelSchema.parse(input);
		return service.cancel(args.session_id, args.request_id);
	}
	if (name !== 'open_model_picker' && name !== 'get_provider_status')
		throw new Error('Unknown picker operation.');
	return service.status(pickerSessionSchema.parse(input).session_id ?? null);
}
