import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';

// Account connectors join a running session as a large system message with `tool_addition`
// blocks. `--tools` limits only built-in tools, so MCP has to be shut off separately.
test('a Claude module worker loads no account or user MCP servers', () => {
	const command = new ModuleTaskRunnerAdapter().command({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		intelligence: 'medium'
	});
	expect(command).toContain('--strict-mcp-config');
	expect(command).not.toContain('--mcp-config');
});
