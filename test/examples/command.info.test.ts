import type { Registration, Invocation } from './command.info.test.types';
import { Command } from 'commander';
import { test, vi } from 'vitest';
import { registerInfoCommand } from '../../src/cli/program/info';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function summarizeError(error: unknown): { name: string; message: string } {
	return error instanceof Error
		? { name: error.name, message: error.message }
		: { name: typeof error, message: String(error) };
}

function registrationOf(program: Command): Registration {
	const info = program.commands[0];
	if (!info) throw new Error('registerInfoCommand did not attach an info command');
	return {
		name: info.name(),
		description: info.description(),
		arguments: info.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: info.options.map((option) => option.flags)
	};
}

/** Invokes the registered action through a named Commander program, as buildProgram does. */
async function invokeInfo(args: string[]): Promise<Invocation> {
	const program = new Command()
		.name('harness')
		.description('Opinionated Rails-inspired coding harnesses for humans and agents.')
		.exitOverride();
	registerInfoCommand(program);
	const registration = registrationOf(program);
	const printed: string[] = [];
	const log = vi.spyOn(console, 'log').mockImplementation((line) => printed.push(String(line)));
	let caught: unknown;
	try {
		await program.parseAsync(['info', ...args], { from: 'user' });
	} catch (error) {
		caught = error;
	} finally {
		log.mockRestore();
	}
	return {
		registration,
		printed,
		error: caught === undefined ? null : summarizeError(caught)
	};
}

test('printed guidance for a topic as text or JSON', async () => {
	const markdown = await invokeInfo(['model']);
	const structured = await invokeInfo(['component', '--json']);
	const expectedRegistration = {
		name: 'info',
		description: 'Show static Harness guidance for adding code.',
		arguments: [{ name: 'topic', required: true }],
		options: ['--json']
	};
	expect(markdown.registration).toEqual(expectedRegistration);
	expect(structured.registration).toEqual(expectedRegistration);
	expect(markdown.printed.join('')).toContain('## Steps');
	expect(markdown.error).toBeNull();
	expect(JSON.parse(structured.printed.join(''))).toMatchObject({ topic: 'component' });
	expect(structured.error).toBeNull();
	recordExampleCases(
		{
			unitId: 'command.info',
			symbol: 'registerInfoCommand',
			state: 'printed-guidance-for-a-topic-as-text-or-json',
			evidence: 'examples-cases',
			file: 'printed-guidance-for-a-topic-as-text-or-json.json'
		},
		[
			{
				name: 'render model guidance as Markdown',
				input: { program: 'harness', argv: ['info', 'model'] },
				output: { registration: markdown.registration, printed: markdown.printed.join('') }
			},
			{
				name: 'print component guidance as JSON',
				input: { program: 'harness', argv: ['info', 'component', '--json'] },
				output: { registration: structured.registration, printed: structured.printed.join('') }
			}
		]
	);
});

test('rejected an unknown topic and listed available topics', async () => {
	const invocation = await invokeInfo(['not-a-topic']);
	const error = invocation.error;
	expect(error).not.toBeNull();
	if (!error) throw new Error('Unknown topic invocation completed without an error');
	expect(error.name).toBe('ExpectedCliError');
	expect(error.message).toContain('Unknown info topic "not-a-topic".');
	expect(error.message).toContain('Use one of: ');
	expect(error.message).toContain('component');
	expect(error.message).toContain('model');
	expect(invocation.printed).toEqual([]);
	recordExampleCases(
		{
			unitId: 'command.info',
			symbol: 'registerInfoCommand',
			state: 'rejected-an-unknown-topic-and-listed-available-topics',
			evidence: 'examples-cases',
			file: 'rejected-an-unknown-topic-and-listed-available-topics.json'
		},
		[
			{
				name: 'a topic that has no guide',
				input: { program: 'harness', argv: ['info', 'not-a-topic'] },
				error
			}
		]
	);
});
