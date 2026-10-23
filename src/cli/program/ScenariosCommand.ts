import type { Flags } from './ScenariosCommand.types';
import type { Command } from 'commander';
import { fail } from '../../core/development-tooling/errors';
import { checkScenarios, listScenarios, showScenario } from './inspectScenarios';

export function registerScenariosCommand(program: Command): void {
	const scenarios = program
		.command('scenarios')
		.description('Inspect scenario contracts: states, viewports, tests and required evidence.');
	scenarios
		.command('list')
		.option('--json', 'Print structured results.')
		.description('List scenarios with how many captures each demands.')
		.action(async (flags: Flags) => {
			const listed = await listScenarios();
			const text = listed
				.map(
					(item) =>
						`${item.id}  ${item.kind}  ${item.captures} captures, ` +
						`${item.unproven} unproven, ${item.excluded} excluded`
				)
				.join('\n');
			console.log(flags.json ? JSON.stringify(listed, null, 2) : text);
		});
	scenarios
		.command('show <id>')
		.option('--json', 'Print structured results.')
		.description('Show the exact captures a scenario requires and the states it does not prove.')
		.action(async (id: string, flags: Flags) => {
			const shown = await showScenario(id);
			const capture = (item: (typeof shown.required)[number]) =>
				`  ${item.kind} ${item.evidence}: ${item.state}${item.viewport ? ` at ${item.viewport}` : ''}`;
			const text = [
				`# ${shown.scenario.id} (${shown.scenario.kind})`,
				'Required captures:',
				...shown.required.map(capture),
				...shown.unproven.map((item) => `Unproven state ${item.state}: ${item.reason}`),
				...shown.excluded.map((item) => `Inapplicable state ${item.state}: ${item.reason}`)
			].join('\n');
			console.log(flags.json ? JSON.stringify(shown, null, 2) : text);
		});
	scenarios
		.command('check')
		.description('Fail when a scenario contract is invalid or misstates its coverage.')
		.action(async () => {
			const result = await checkScenarios();
			if (result.errors.length > 0) fail(result.errors.join('\n'));
			console.log(`Scenario contracts are valid: ${result.scenarios} scenarios.`);
		});
}
