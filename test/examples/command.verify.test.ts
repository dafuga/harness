import { Command } from 'commander';
import { test, vi } from 'vitest';
import { ExpectedCliError } from '../../src/core/development-tooling/errors';
import { registerVerifyCommand } from '../../src/cli/program/VerifyCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const workflowMocks = vi.hoisted(() => ({
	renderVerify: vi.fn(),
	verifyCheck: vi.fn(),
	verifyIdentity: vi.fn(),
	verifyPlan: vi.fn(),
	verifyRun: vi.fn(),
	verifyStamp: vi.fn()
}));

vi.mock('../../src/workflows/verification-evidence/run-verify/runVerify', () => workflowMocks);

function summarizeCommand(command: Command) {
	return {
		name: command.name(),
		arguments: command.registeredArguments.map((argument) => ({
			name: argument.name(),
			required: argument.required
		})),
		options: command.options.map((option) =>
			option.defaultValue === undefined
				? { flags: option.flags }
				: { flags: option.flags, default: option.defaultValue }
		)
	};
}

const expectedRegistration = {
	returned: 'void',
	programCommands: ['verify'],
	verify: {
		name: 'verify',
		description: 'Verify an exact commit in a clean snapshot and gate on its record.',
		subcommands: [
			{
				name: 'run',
				arguments: [],
				options: [
					{ flags: '--priority <kind>' },
					{ flags: '--commit <revision>', default: 'HEAD' },
					{ flags: '--base <revision>' },
					{ flags: '--runtime <kind>' },
					{ flags: '--test-timeout <ms>' },
					{ flags: '--require-performance' },
					{ flags: '--entity <id>' },
					{ flags: '--json' }
				]
			},
			{
				name: 'plan',
				arguments: [],
				options: [
					{ flags: '--commit <revision>', default: 'HEAD' },
					{ flags: '--base <revision>' },
					{ flags: '--runtime <kind>' },
					{ flags: '--test-timeout <ms>' },
					{ flags: '--entity <id>' },
					{ flags: '--json' }
				]
			},
			{
				name: 'check',
				arguments: [],
				options: [
					{ flags: '--commit <revision>', default: 'HEAD' },
					{ flags: '--record <file>' },
					{ flags: '--json' }
				]
			},
			{
				name: 'identity',
				arguments: [{ name: 'directory', required: true }],
				options: [{ flags: '--json' }]
			},
			{
				name: 'stamp',
				arguments: [{ name: 'directory', required: true }],
				options: [{ flags: '--json' }]
			}
		]
	}
};

test('Registers the verify command and all five subcommands', () => {
	const program = new Command().name('harness');
	const returned = registerVerifyCommand(program);
	const verify = program.commands.find((command) => command.name() === 'verify');
	expect(verify).toBeDefined();
	if (!verify) throw new Error('registerVerifyCommand did not add verify');

	const registered = {
		returned: returned ?? 'void',
		programCommands: program.commands.map((command) => command.name()),
		verify: {
			name: verify.name(),
			description: verify.description(),
			subcommands: verify.commands.map(summarizeCommand)
		}
	};
	expect(registered).toEqual(expectedRegistration);
	recordExampleCases(
		{
			unitId: 'command.verify',
			symbol: 'registerVerifyCommand',
			state: 'registers-the-verify-command-and-all-five-subcommands',
			evidence: 'examples-cases',
			file: 'registers-the-verify-command-and-all-five-subcommands.json'
		},
		[
			{
				name: 'register verify on a named harness program',
				input: { program: { name: 'harness', existingCommands: [] } },
				output: registered
			}
		]
	);
});

test('Verify check joins failed problems without JSON', async () => {
	const report = {
		status: 'failed',
		problems: ['the verification record is missing', 'the commit is not verified']
	};
	workflowMocks.verifyCheck.mockResolvedValue(report);
	const program = new Command().name('harness').exitOverride();
	registerVerifyCommand(program);
	let thrown: unknown;
	try {
		await program.parseAsync(['verify', 'check'], { from: 'user' });
	} catch (error) {
		thrown = error;
	}
	expect(workflowMocks.verifyCheck).toHaveBeenCalledOnce();
	expect(workflowMocks.verifyCheck.mock.calls[0]?.[0]).toMatchObject({ commit: 'HEAD' });
	expect(thrown).toBeInstanceOf(ExpectedCliError);
	expect(thrown).toMatchObject({
		name: 'ExpectedCliError',
		message: 'the verification record is missing\nthe commit is not verified'
	});
	recordExampleCases(
		{
			unitId: 'command.verify',
			symbol: 'registerVerifyCommand',
			state: 'verify-check-joins-failed-problems-without-json',
			evidence: 'examples-cases',
			file: 'verify-check-joins-failed-problems-without-json.json'
		},
		[
			{
				name: 'verify check without --json when its text report fails',
				input: { argv: ['verify', 'check'], report },
				error: {
					name: 'ExpectedCliError',
					message: 'the verification record is missing\nthe commit is not verified'
				}
			}
		]
	);
});
