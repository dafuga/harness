import type { Options } from '@anthropic-ai/claude-agent-sdk';
import type { GatewaySession } from './gatewayTypes';
export function gatewayOptions(session: GatewaySession): Options {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (
			key.startsWith('ANTHROPIC_') ||
			key.startsWith('CLAUDE_CODE_USE_') ||
			key === 'CLAUDE_CODE_OAUTH_TOKEN'
		)
			delete env[key];
	}
	return {
		abortController: session.controller,
		env,
		tools: [],
		settingSources: [],
		persistSession: false,
		includePartialMessages: true,
		model: 'claude-opus-5-5',
		effort: 'xhigh',
		permissionMode: 'dontAsk',
		cwd: '/tmp',
		pathToClaudeCodeExecutable:
			process.env.HARNESS_CLAUDE_EXECUTABLE ?? `${process.env.HOME}/.local/bin/claude`,
		extraArgs: { 'strict-mcp-config': null, 'no-chrome': null }
	};
}
