import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { ProcessRuntimeAdapter } from '../../src/adapters/execution-runtimes/process-runtime-adapter/ProcessRuntimeAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

function installRuntime(directory: string): string {
	const executable = join(directory, 'runtime');
	writeFileSync(
		executable,
		`#!/usr/bin/env node
let input = '';
process.stdin.setEncoding('utf8');
const respond = (text, line) => {
	const request = JSON.parse(text);
	const output = JSON.stringify({
		ok: true,
		output: { operation: request.operation, input: request.input ?? null }
	});
	process.stdout.write(line ? output + '\\n' : output);
};
process.stdin.on('data', (chunk) => {
	input += chunk;
	let end = input.indexOf('\\n');
	while (end !== -1) {
		respond(input.slice(0, end), true);
		input = input.slice(end + 1);
		end = input.indexOf('\\n');
	}
});
process.stdin.on('end', () => {
	if (input) respond(input, false);
});
`
	);
	chmodSync(executable, 0o700);
	return executable;
}

test('invoke sends a JSON request to a one-shot runtime', async () => {
	await withTempDir('process-runtime-examples-', async (directory) => {
		const adapter = new ProcessRuntimeAdapter({
			command: installRuntime(directory),
			args: [],
			persistent: false,
			timeoutMs: 1000
		});
		const request = { operation: 'render', input: { path: 'src/index.ts' } };
		const output = await adapter.invoke(request);
		expect(output).toEqual({ ok: true, output: request });
		recordExampleCases(
			{
				unitId: 'adapter.process-runtime',
				symbol: 'ProcessRuntimeAdapter.invoke',
				state: 'invoke-sends-a-json-request-to-a-one-shot-runtime',
				evidence: 'examples-cases',
				file: 'invoke-sends-a-json-request-to-a-one-shot-runtime.json'
			},
			[
				{
					name: 'render request returns its operation and input',
					input: request,
					output
				}
			]
		);
	});
}, 20_000);

test('invokeText returns one-shot stdout unchanged', async () => {
	await withTempDir('process-runtime-examples-', async (directory) => {
		const adapter = new ProcessRuntimeAdapter({
			command: installRuntime(directory),
			args: [],
			timeoutMs: 1000
		});
		const input = '{"operation":"render","input":{"path":"src/index.ts"}}';
		const output = await adapter.invokeText(input);
		expect(output).toBe(
			'{"ok":true,"output":{"operation":"render","input":{"path":"src/index.ts"}}}'
		);
		recordExampleCases(
			{
				unitId: 'adapter.process-runtime',
				symbol: 'ProcessRuntimeAdapter.invokeText',
				state: 'invoketext-returns-one-shot-stdout-unchanged',
				evidence: 'examples-cases',
				file: 'invoketext-returns-one-shot-stdout-unchanged.json'
			},
			[
				{
					name: 'raw render request returns the child response text',
					input,
					output
				}
			]
		);
	});
}, 20_000);

test('close stops the persistent runtime after a line exchange', async () => {
	await withTempDir('process-runtime-examples-', async (directory) => {
		const adapter = new ProcessRuntimeAdapter({
			command: installRuntime(directory),
			args: [],
			persistent: true,
			timeoutMs: 1000
		});
		const request = '{"operation":"render","input":{"path":"src/index.ts"}}';
		const response = await adapter.invokeText(request);
		expect(response).toBe(
			'{"ok":true,"output":{"operation":"render","input":{"path":"src/index.ts"}}}'
		);
		const output = await adapter.close();
		expect(output).toBeUndefined();
		recordExampleCases(
			{
				unitId: 'adapter.process-runtime',
				symbol: 'ProcessRuntimeAdapter.close',
				state: 'close-stops-the-persistent-runtime-after-a-line-exchange',
				evidence: 'examples-cases',
				file: 'close-stops-the-persistent-runtime-after-a-line-exchange.json'
			},
			[
				{
					name: 'persistent runtime is closed after returning a line response',
					input: { persistent: true, request },
					output: null
				}
			]
		);
	});
}, 20_000);
