// @harness-uid u_rw64iex44n
import type { TaskSelection } from '../../../../repositories/agents-providers/ModuleTaskRepository.types';

const codexPaths = new Set([
	'GET /codex/models',
	'POST /codex/responses',
	'POST /codex/responses/compact'
]);
const claudePaths = new Set([
	'GET /v1/models',
	'POST /v1/messages',
	'POST /v1/messages/count_tokens'
]);

export function providerDestination(
	request: Request,
	provider: TaskSelection['provider']
): URL | undefined {
	const { pathname, search } = new URL(request.url);
	const route = `${request.method} ${pathname}`;
	if (provider === 'claude') {
		if (!claudePaths.has(route)) return undefined;
		return new URL('https://api.anthropic.com' + pathname + search);
	}
	if (!codexPaths.has(route)) return undefined;
	const base = request.headers.has('chatgpt-account-id')
		? 'https://chatgpt.com/backend-api/codex'
		: 'https://api.openai.com/v1';
	return new URL(base + pathname.slice('/codex'.length) + search);
}

export function guardedProviderCommand(
	command: string[],
	provider: TaskSelection['provider'],
	origin: string
) {
	if (provider === 'claude') return command;
	return [
		...command.slice(0, -1),
		'--disable',
		'enable_request_compression',
		'--disable',
		'apps',
		'-c',
		'model_provider="harness-admission"',
		'-c',
		'model_providers.harness-admission.name="Harness"',
		'-c',
		'model_providers.harness-admission.requires_openai_auth=true',
		'-c',
		'model_providers.harness-admission.supports_websockets=false',
		'-c',
		`model_providers.harness-admission.base_url="${origin}/codex"`,
		...command.slice(-1)
	];
}

export function relayHeaders(original: Headers): Headers {
	const headers = new Headers(original);
	for (const key of [
		'host',
		'connection',
		'content-length',
		'content-encoding',
		'transfer-encoding',
		'proxy-authorization',
		'proxy-authenticate',
		'cookie',
		'set-cookie',
		'accept-encoding'
	])
		headers.delete(key);
	return headers;
}
