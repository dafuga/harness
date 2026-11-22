import { Command } from 'commander';
import { test } from 'vitest';
import { registerBudgetCommand } from '../../src/cli/program/BudgetCommand';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const state = 'registerbudgetcommand-registers-the-budget-command-tree';
const budgetSubcommands = ['measure', 'status', 'history', 'establish', 'approve', 'bench'];

test('registerBudgetCommand registers the budget command tree', () => {
	const emptyProgram = new Command().name('harness');
	const emptyReturn = registerBudgetCommand(emptyProgram);
	const emptyBudget = emptyProgram.commands.find((command) => command.name() === 'budget');
	const siblingProgram = new Command().name('harness');
	siblingProgram.command('status');
	const siblingReturn = registerBudgetCommand(siblingProgram);
	const siblingBudget = siblingProgram.commands.find((command) => command.name() === 'budget');
	const emptyCommands = emptyBudget?.commands.map((command) => command.name()) ?? [];
	const siblingCommands = siblingBudget?.commands.map((command) => command.name()) ?? [];
	const emptyRootCommands = emptyProgram.commands.map((command) => command.name());
	const siblingRootCommands = siblingProgram.commands.map((command) => command.name());

	expect(emptyReturn).toBeUndefined();
	expect(emptyRootCommands).toEqual(['budget']);
	expect(emptyCommands).toEqual(budgetSubcommands);
	expect(siblingReturn).toBeUndefined();
	expect(siblingRootCommands).toEqual(['status', 'budget']);
	expect(siblingCommands).toEqual(budgetSubcommands);

	recordExampleCases(
		{
			unitId: 'command.budget',
			symbol: 'registerBudgetCommand',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[
			{
				name: 'a harness program without existing commands',
				input: { program: 'harness', existingCommands: [] },
				output: {
					returnValue: null,
					programCommands: emptyRootCommands,
					budgetCommands: emptyCommands
				}
			},
			{
				name: 'a harness program with an existing sibling command',
				input: { program: 'harness', existingCommands: ['status'] },
				output: {
					returnValue: null,
					programCommands: siblingRootCommands,
					budgetCommands: siblingCommands
				}
			}
		]
	);
});
