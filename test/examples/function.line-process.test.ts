import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { lineProcess } from '../../src/adapters/execution-runtimes/process-runtime-adapter/lineProcess';

const echoScript =
	"let n = 0; require('node:readline').createInterface({ input: process.stdin }).on('line', (line) => console.log(++n + ':' + line));";

test('Keeps one child process for sequential line exchanges', async () => {
	const runner = lineProcess(process.execPath, ['-e', echoScript]);
	const first = await runner.exchange('alpha', 2000);
	const second = await runner.exchange('beta\r\ngamma', 2000);
	runner.close();
	expect([first, second]).toEqual([{ text: '1:alpha' }, { text: '2:beta gamma' }]);
	recordExampleCases(
		{
			unitId: 'function.line-process',
			symbol: 'lineProcess',
			state: 'keeps-one-child-process-for-sequential-line-exchanges',
			evidence: 'examples-cases',
			file: 'keeps-one-child-process-for-sequential-line-exchanges.json'
		},
		[
			{ name: 'first line receives the first reply', input: 'alpha', output: first },
			{ name: 'CRLF break in second line becomes a space', input: 'beta\r\ngamma', output: second }
		]
	);
});

test('Close stops the child so the next exchange starts a new one', async () => {
	const runner = lineProcess(process.execPath, ['-e', echoScript]);
	const before = await runner.exchange('one', 2000);
	runner.close();
	const after = await runner.exchange('two', 2000);
	runner.close();
	expect([before, after]).toEqual([{ text: '1:one' }, { text: '1:two' }]);
	recordExampleCases(
		{
			unitId: 'function.line-process',
			symbol: 'lineProcess',
			state: 'close-stops-the-child-so-the-next-exchange-starts-a-new-one',
			evidence: 'examples-cases',
			file: 'close-stops-the-child-so-the-next-exchange-starts-a-new-one.json'
		},
		[
			{ name: 'exchange before close replies from the first child', input: 'one', output: before },
			{ name: 'exchange after close replies from a fresh child', input: 'two', output: after }
		]
	);
});

test('Missing command resolves the exchange as runtime-unavailable', async () => {
	const runner = lineProcess('harness-missing-command', []);
	const reply = await runner.exchange('ping', 2000);
	runner.close();
	expect(reply).toEqual({
		failure: {
			ok: false,
			error: {
				code: 'runtime-unavailable',
				message: 'cannot start harness-missing-command: spawn harness-missing-command ENOENT'
			}
		}
	});
	recordExampleCases(
		{
			unitId: 'function.line-process',
			symbol: 'lineProcess',
			state: 'missing-command-resolves-the-exchange-as-runtime-unavailable',
			evidence: 'examples-cases',
			file: 'missing-command-resolves-the-exchange-as-runtime-unavailable.json'
		},
		[{ name: 'command cannot be spawned', input: 'ping', output: reply }]
	);
});

test('Child that exits before replying resolves as runtime-failed', async () => {
	const script = "process.stdin.once('data', () => process.exit(3));";
	const runner = lineProcess(process.execPath, ['-e', script]);
	const reply = await runner.exchange('ping', 2000);
	runner.close();
	expect(reply).toEqual({
		failure: {
			ok: false,
			error: { code: 'runtime-failed', message: 'process exited with code 3' }
		}
	});
	recordExampleCases(
		{
			unitId: 'function.line-process',
			symbol: 'lineProcess',
			state: 'child-that-exits-before-replying-resolves-as-runtime-failed',
			evidence: 'examples-cases',
			file: 'child-that-exits-before-replying-resolves-as-runtime-failed.json'
		},
		[{ name: 'child exits with status 3 without output', input: 'ping', output: reply }]
	);
});

test('Silent child times out and is killed', async () => {
	const runner = lineProcess(process.execPath, ['-e', 'process.stdin.resume();']);
	const reply = await runner.exchange('ping', 50);
	runner.close();
	expect(reply).toHaveProperty('failure.ok', false);
	recordExampleCases(
		{
			unitId: 'function.line-process',
			symbol: 'lineProcess',
			state: 'silent-child-times-out-and-is-killed',
			evidence: 'examples-cases',
			file: 'silent-child-times-out-and-is-killed.json'
		},
		[
			{
				name: 'no line within 50 ms fails the exchange',
				input: { line: 'ping', timeoutMs: 50 },
				output: reply
			}
		]
	);
});
