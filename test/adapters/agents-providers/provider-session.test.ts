import { mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { withTempDir } from '../../support/temporary';
import { runCommand } from '../../support/cli';
import { ProviderSessionAdapter } from '../../../src/adapters/agents-providers/ProviderSessionAdapter';
import { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';
import {
	contextStop,
	defaultContextTokens,
	hardContextTokens
} from '../../../src/adapters/agents-providers/module-task-runner-adapter/sessionPolicy';

test('an emergency context reading stops the run instead of rotating again', () => {
	expect(contextStop(null, defaultContextTokens)).toBeUndefined();
	expect(contextStop(defaultContextTokens - 1, defaultContextTokens)).toBeUndefined();
	expect(contextStop(defaultContextTokens, defaultContextTokens)).toBe('rotated');
	expect(contextStop(hardContextTokens - 1, defaultContextTokens)).toBe('rotated');
	expect(contextStop(hardContextTokens, defaultContextTokens)).toBe('hard-limit');
	expect(contextStop(200000, defaultContextTokens)).toBe('hard-limit');
});

test('a malformed completed stream fails while retaining available token usage', async () => {
	const runner = new ModuleTaskRunnerAdapter(async () => ({
		code: 0,
		stdout:
			'partial event\n{"type":"turn.completed","usage":{"input_tokens":200,"output_tokens":5}}\n'
	}));
	await expect(
		runner.run({
			provider: 'codex',
			model: 'gpt-6.2-sol',
			intelligence: 'low',
			cwd: '.',
			prompt: 'Goal',
			signal: new AbortController().signal
		})
	).rejects.toMatchObject({
		message: 'Task CLI returned malformed structured output.',
		usage: { inputTokens: 200, outputTokens: 5 }
	});
});

test('Codex reads only its own appended rollout and distinguishes peak context from total usage', async () => {
	await withTempDir('harness-codex-meter-', async (home) => {
		const id = '10000000-1111-2222-3333-444444444444';
		const meter = new ProviderSessionAdapter('codex', home);
		meter.event(JSON.stringify({ type: 'thread.started', thread_id: id }));
		const directory = join(
			home,
			'sessions',
			new Date().toISOString().slice(0, 10).replaceAll('-', '/')
		);
		await mkdir(directory, { recursive: true });
		const rollout = join(directory, `rollout-fixture-${id}.jsonl`);
		await appendFile(join(directory, 'rollout-unrelated.jsonl'), counter(500000, 1000000) + '\n');
		expect(meter.sample().peakContextTokens).toBeNull();
		const first = counter(1000, 5000);
		await appendFile(rollout, '{"text":"' + 'x'.repeat(100000) + '"}\n' + first.slice(0, 40));
		expect(meter.sample().peakContextTokens).toBeNull();
		await appendFile(rollout, first.slice(40) + '\n' + counter(900, 5900) + '\n');
		expect(meter.sample()).toMatchObject({
			sessionId: id,
			peakContextTokens: 1000,
			usage: { inputTokens: 5900, outputTokens: 400 }
		});
	});
});

test('Claude measures cache-inclusive context at message start and counts a streamed message once', () => {
	const meter = new ProviderSessionAdapter('claude', 'unused');
	const message = {
		id: 'message-1',
		usage: {
			input_tokens: 1000,
			cache_read_input_tokens: 8000,
			cache_creation_input_tokens: 500,
			output_tokens: 1
		}
	};
	meter.event(JSON.stringify({ type: 'stream_event', event: { type: 'message_start', message } }));
	expect(meter.sample().peakContextTokens).toBe(9500);
	meter.event(
		JSON.stringify({
			type: 'stream_event',
			event: { type: 'message_delta', usage: { output_tokens: 9 } }
		})
	);
	const final = {
		type: 'assistant',
		message: { ...message, usage: { ...message.usage, output_tokens: 9 } }
	};
	meter.event(JSON.stringify(final));
	meter.event(JSON.stringify(final));
	expect(meter.summary()).toMatchObject({
		peakContextTokens: 9500,
		usage: { inputTokens: 9500, outputTokens: 9 }
	});
});

test('pre-request refusal sends no upstream call and preserves scoped authentication', async () => {
	const operation = await runCommand(['bun', '-e', relayProbe], process.cwd());
	expect(JSON.parse(operation.stdout.trim())).toEqual([
		{ provider: 'codex', admitted: 200, refused: 400, otherRoute: 404, forwarded: 1, scoped: true },
		{ provider: 'claude', admitted: 200, refused: 400, otherRoute: 404, forwarded: 1, scoped: true }
	]);
});

const relayProbe = `
import { ProviderRequestGate } from './src/adapters/agents-providers/module-task-runner-adapter/ProviderRequestGate';
const results = [];
for (const provider of ['codex','claude']) {
  const codex = provider === 'codex';
  const path = codex ? '/codex/responses' : '/v1/messages';
  const field = codex ? 'input' : 'messages';
  const event = codex
    ? {type:'response.completed',response:{usage:{input_tokens:137000,output_tokens:1000}}}
    : {type:'message_start',message:{usage:{input_tokens:30000,cache_read_input_tokens:100000,cache_creation_input_tokens:8000}}};
  let forwarded = 0, scoped = false;
  const gate = new ProviderRequestGate(provider, () => null, async (destination, options) => {
    forwarded++;
    scoped = destination.origin === (codex ? 'https://chatgpt.com' : 'https://api.anthropic.com') &&
      options.headers.get('authorization') === 'Bearer fixture-auth' && !options.headers.has('cookie') &&
      !destination.href.includes('fixture-auth') && options.redirect === 'error';
    return new Response('data: ' + JSON.stringify(event) + '\\n\\n',{headers:{'content-type':'text/event-stream'}});
  });
  try {
    const headers = {authorization:'Bearer fixture-auth','chatgpt-account-id':'fixture-account',cookie:'store=fixture', 'content-type':'application/json'};
    const first = {role:'user',content:'A small first request.'};
    const message = (items) => fetch(gate.origin+path,{method:'POST',headers,body:JSON.stringify({[field]:items})});
    const otherRoute = await fetch(gate.origin+'/unexpected',{method:'POST',headers,body:'{}'});
    const admitted = await message([first]);
    await admitted.text();
    const refused = await message([first,{role:'user',content:'aA9!+'.repeat(12000)}]);
    results.push({provider,admitted:admitted.status,refused:refused.status,otherRoute:otherRoute.status,forwarded,scoped});
  } finally { await gate.close(); }
}
console.log(JSON.stringify(results));
`;

function counter(context: number, total: number): string {
	return JSON.stringify({
		type: 'event_msg',
		payload: {
			type: 'token_count',
			info: {
				last_token_usage: { input_tokens: context },
				total_token_usage: { input_tokens: total, cached_input_tokens: 400, output_tokens: 400 }
			}
		}
	});
}
