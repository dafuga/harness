// @harness-uid u_rw64iex44n
import type { TaskSelection } from '../../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { ProviderUsageFrame } from './providerUsageStream.types';

const maximumFrame = 1024 * 1024;

/** Read post-request usage before releasing the provider frame to the CLI. */
export function measureResponse(
	response: Response,
	provider: TaskSelection['provider'],
	observed: (tokens: number) => void
) {
	if (!response.body || !response.ok) return response.body;
	const events = Boolean(response.headers.get('content-type')?.includes('text/event-stream'));
	const reader = usageReader(events, (line) => readUsage(line, provider, observed));
	const decoder = new TextDecoder();
	return response.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, output) {
				reader.push(decoder.decode(chunk, { stream: true }));
				output.enqueue(chunk);
			},
			flush() {
				reader.push(decoder.decode());
				reader.finish();
			}
		})
	);
}

function usageReader(events: boolean, observe: (line: string) => void) {
	let pending = '';
	let truncated = false;
	const append = (part: string) => {
		if (truncated) return;
		if (pending.length + part.length <= maximumFrame) pending += part;
		else {
			truncated = true;
			pending = '';
		}
	};
	const finish = () => {
		if (!truncated && pending) observe(pending);
		truncated = false;
		pending = '';
	};
	return {
		push(text: string) {
			if (!events) append(text);
			else {
				const parts = text.split('\n');
				const tail = parts.pop() ?? '';
				for (const part of parts) {
					append(part);
					finish();
				}
				append(tail);
			}
		},
		finish
	};
}

function readUsage(
	line: string,
	provider: TaskSelection['provider'],
	observed: (tokens: number) => void
) {
	if (!line.trim() || (!line.startsWith('data:') && !line.trimStart().startsWith('{'))) return;
	try {
		const json = JSON.parse(line.startsWith('data:') ? line.slice(5) : line) as ProviderUsageFrame;
		const usage = provider === 'codex' ? codexUsage(json) : claudeUsage(json);
		if (usage !== undefined) observed(usage);
	} catch {
		// The transport can omit usage. The next admission uses the prior conservative estimate.
	}
}

function codexUsage(row: ProviderUsageFrame): number | undefined {
	const usage = row.response?.usage ?? row.usage;
	const input = tokenCount(usage?.input_tokens);
	if (input === undefined) return undefined;
	return input + (tokenCount(usage?.output_tokens) ?? 0);
}

function claudeUsage(row: ProviderUsageFrame): number | undefined {
	if (row.type !== 'message_start' && row.type !== 'message') return undefined;
	const { input_tokens, cache_read_input_tokens, cache_creation_input_tokens } =
		row.message?.usage ?? row.usage ?? {};
	const input = tokenCount(input_tokens);
	if (input === undefined) return undefined;
	return (
		input +
		(tokenCount(cache_read_input_tokens) ?? 0) +
		(tokenCount(cache_creation_input_tokens) ?? 0)
	);
}

function tokenCount(value: number | undefined): number | undefined {
	return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}
