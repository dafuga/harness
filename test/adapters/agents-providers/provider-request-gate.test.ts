import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { runCommand } from '../../support/cli';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';

test('tools that load mid-session are counted once and an oversized tool set is still refused', async () => {
	const operation = await runCommand(['bun', '-e', toolRelayProbe], process.cwd());
	expect(JSON.parse(operation.stdout.trim())).toEqual({
		statuses: [200, 200, 200, 400],
		forwarded: 3
	});
});

test('a Claude module worker starts without account or user MCP servers', () => {
	const command = new ModuleTaskRunnerAdapter().command({
		provider: 'claude',
		model: 'claude-haiku-5-5',
		intelligence: 'medium'
	});
	expect(command).toContain('--strict-mcp-config');
	expect(command).not.toContain('--mcp-config');
});

// Token sizes follow a recorded Haiku session: 26.8k before connectors load, 120.8k after.
const toolRelayProbe = `
import { ProviderRequestGate } from './src/adapters/agents-providers/module-task-runner-adapter/ProviderRequestGate';
let used = 26833, forwarded = 0;
const gate = new ProviderRequestGate('claude', () => null, async () => {
  forwarded++;
  const event = {type:'message_start',message:{usage:{input_tokens:used}}};
  return new Response('data: ' + JSON.stringify(event) + '\\n\\n',{headers:{'content-type':'text/event-stream'}});
});
const tool = (name) => ({name,description:'aA9!+ '.repeat(130),input_schema:{type:'object'}});
const tools = (prefix, length) => Array.from({length}, (_, i) => tool(prefix + i));
const builtIn = tools('built_in_', 7), connected = tools('mcp__fixture__early_', 130);
const send = async (list) => {
  const response = await fetch(gate.origin + '/v1/messages', {method:'POST',headers:{authorization:'fixture'},
    body:JSON.stringify({tools:list,messages:[{role:'user',content:'A small request.'}]})});
  await response.text();
  return response.status;
};
try {
  const statuses = [await send(builtIn)];
  used = 120793;
  statuses.push(await send([...builtIn, ...connected]));
  statuses.push(await send([...builtIn, tool('mcp__fixture__late'), ...connected]));
  statuses.push(await send([...builtIn, ...connected, ...tools('mcp__fixture__huge_', 130)]));
  console.log(JSON.stringify({statuses,forwarded}));
} finally { await gate.close(); }
`;
