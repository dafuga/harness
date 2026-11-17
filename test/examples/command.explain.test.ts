import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { test } from 'vitest';
import { registerExplainCommand } from '../../src/cli/program/ExplainCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

type Repository = { root: string; git: (...args: string[]) => string };

const rangeOptions = ['--base <revision>', '--head <revision>'];
const identity = ['-c', 'user.name=Example', '-c', 'user.email=example@example.invalid'];
const unitFile = 'src/greeting.ts';

const expectedTree = [
	{
		name: 'explain',
		description: 'Record why each changed function or unit changed, and what was tried.',
		options: [],
		subcommands: [
			{
				name: 'add',
				description: 'Record a reason bound to the exact content of the change.',
				options: [
					...rangeOptions,
					'--unit <id>',
					'--symbol <name>',
					'--all',
					'--replace',
					'--behavior <text>',
					'--simplification <text>',
					'--simplification-outcome <outcome>',
					'--performance <text>',
					'--performance-outcome <outcome>'
				],
				subcommands: []
			},
			{
				name: 'list',
				description: 'List the changes that need a reason and whether each has one.',
				options: [...rangeOptions, '--json'],
				subcommands: []
			},
			{
				name: 'check',
				description: 'Fail when a changed function or unit has no current reason.',
				options: [...rangeOptions],
				subcommands: []
			}
		]
	}
];

function describeCommand(command: Command): unknown {
	return {
		name: command.name(),
		description: command.description(),
		options: command.options.map((option) => option.flags),
		subcommands: command.commands.map((subcommand) => describeCommand(subcommand))
	};
}

function greeting(body: string): string {
	return `// @harness-uid u_explainexample1\nexport function greet() {\n\treturn '${body}';\n}\n`;
}

// Commits a unit, then edits it without a reason, so `explain check` has an unexplained change.
function changeUnitWithoutReason(repository: Repository): void {
	mkdirSync(join(repository.root, 'src'), { recursive: true });
	writeFileSync(join(repository.root, unitFile), greeting('hello'));
	repository.git('add', '.');
	repository.git(...identity, 'commit', '-m', 'Add greeting');
	writeFileSync(join(repository.root, unitFile), greeting('goodbye'));
}

// Runs the real `explain check` action from inside the fixture and returns what it threw, if anything.
async function runCheck(root: string): Promise<unknown> {
	const cwd = process.cwd();
	process.chdir(root);
	try {
		const program = new Command().name('harness').exitOverride();
		registerExplainCommand(program);
		await program.parseAsync(['node', 'harness', 'explain', 'check'], { from: 'node' });
		return undefined;
	} catch (error) {
		return error;
	} finally {
		process.chdir(cwd);
	}
}

test('Registers the explain add, list and check commands', () => {
	const program = new Command().name('harness');
	registerExplainCommand(program);
	const registered = program.commands.map((command) => describeCommand(command));

	expect(program.commands.map((command) => command.name())).toEqual(['explain']);
	expect(registered).toEqual(expectedTree);
	recordExampleCases(
		{
			unitId: 'command.explain',
			symbol: 'registerExplainCommand',
			state: 'registers-the-explain-add-list-and-check-commands',
			evidence: 'examples-cases',
			file: 'registers-the-explain-add-list-and-check-commands.json'
		},
		[
			{
				name: 'a harness program with no other commands',
				input: { program: 'harness', existingCommands: [] },
				output: {
					programCommands: program.commands.map((command) => command.name()),
					registered
				}
			}
		]
	);
});

test('Throws ExpectedCliError when a changed unit has no reason', async () => {
	await withTempRepo(async (repository) => {
		changeUnitWithoutReason(repository);
		const thrown = await runCheck(repository.root);

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).name).toBe('ExpectedCliError');
		recordExampleCases(
			{
				unitId: 'command.explain',
				symbol: 'registerExplainCommand',
				state: 'throws-expectedclierror-when-a-changed-unit-has-no-reason',
				evidence: 'examples-cases',
				file: 'throws-expectedclierror-when-a-changed-unit-has-no-reason.json'
			},
			[
				{
					name: 'explain check on a unit edited after its commit, with no stored reason',
					input: { command: 'explain check', changedFile: unitFile, reasons: 0 },
					error: { name: (thrown as Error).name, message: (thrown as Error).message }
				}
			]
		);
	});
});
