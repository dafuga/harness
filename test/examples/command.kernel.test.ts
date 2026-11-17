import { Command } from 'commander';
import { test, vi } from 'vitest';
import { registerKernelCommand } from '../../src/cli/program/KernelCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

vi.mock('../../src/cli/program/run-kernel/runKernel', async () => {
	const actual = await vi.importActual('../../src/cli/program/run-kernel/runKernel');
	return {
		...actual,
		kernelParity: async () => ({ status: 'failed', cases: 1 }),
		parityProblems: () => ['runtime results differ']
	};
});

const expectedCommands = [
	{ name: 'parity', options: [{ flags: '--json' }] },
	{
		name: 'bench',
		options: [
			{ flags: '--quick' },
			{ flags: '--boundary' },
			{ flags: '--write [file]' },
			{ flags: '--json' }
		]
	},
	{
		name: 'default',
		options: [{ flags: '--measurements <file>' }, { flags: '--json' }]
	},
	{
		name: 'serve',
		options: [
			{ flags: '--port <port>', default: '0' },
			{ flags: '--runtime <kind>', default: 'module' }
		]
	},
	{
		name: 'sample',
		options: [
			{ flags: '--runtime <kind>' },
			{ flags: '--nodes <count>', default: '1000' },
			{ flags: '--seed <seed>', default: '7' },
			{ flags: '--url <url>' }
		]
	}
];

test('Registers the kernel command tree and its options', () => {
	const program = new Command().name('harness');
	const returned = registerKernelCommand(program);
	const kernel = program.commands.find((command) => command.name() === 'kernel');
	if (!kernel) throw new Error('registerKernelCommand did not add kernel');
	const commands = kernel.commands.map((command) => ({
		name: command.name(),
		options: command.options.map((option) =>
			option.defaultValue === undefined
				? { flags: option.flags }
				: { flags: option.flags, default: option.defaultValue }
		)
	}));
	const tree = { name: kernel.name(), commands };

	expect(returned).toBeUndefined();
	expect(program.commands.map((command) => command.name())).toEqual(['kernel']);
	expect(commands).toEqual(expectedCommands);
	recordExampleCases(
		{
			unitId: 'command.kernel',
			symbol: 'registerKernelCommand',
			state: 'registers-the-kernel-command-tree-and-its-options',
			evidence: 'examples-cases',
			file: 'registers-the-kernel-command-tree-and-its-options.json'
		},
		[
			{
				name: 'program named harness with no existing commands',
				input: { program: 'harness', existingCommands: [] },
				output: { returned: returned === undefined, command: tree }
			}
		]
	);
});

test('Throws ExpectedCliError when parity reports problems', async () => {
	const program = new Command().exitOverride();
	registerKernelCommand(program);
	const printed: string[] = [];
	const log = vi.spyOn(console, 'log').mockImplementation((message) => printed.push(String(message)));
	let caught: unknown;
	try {
		await program.parseAsync(['node', 'harness', 'kernel', 'parity']);
	} catch (error) {
		caught = error;
	} finally {
		log.mockRestore();
	}
	expect(caught).toMatchObject({ name: 'ExpectedCliError' });
	expect(printed).toEqual(['Kernel parity failed: 1 cases per runtime.']);
	recordExampleCases(
		{
			unitId: 'command.kernel',
			symbol: 'parity',
			state: 'throws-expectedclierror-when-parity-reports-problems',
			evidence: 'examples-cases',
			file: 'throws-expectedclierror-when-parity-reports-problems.json'
		},
		[
			{
				name: 'parity report with one runtime disagreement',
				input: { command: 'kernel parity', report: { status: 'failed', cases: 1 }, problems: ['runtime results differ'] },
				error: { name: 'ExpectedCliError', message: 'runtime results differ' }
			}
		]
	);
});
