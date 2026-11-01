import type { Command } from 'commander';
import type { GuidanceOptions } from '../../workflows/development-tooling/guide-units/guideUnits.types';
import {
	guideUnits,
	renderUnitsGuide
} from '../../workflows/development-tooling/guide-units/guideUnits';
import {
	checkUnitContracts,
	renderContractCheck
} from '../../workflows/development-tooling/guide-units/checkUnitContracts';
import type { GuidanceFlags } from './unitsGuidance.types';

export function registerUnitsGuidance(units: Command): void {
	units
		.command('guide <id>')
		.description('List required and guessed states, committed tests, verified shots and NEXT.')
		.option('--json', 'Print the state checklist as JSON.')
		.option('--required-states <paths...>', 'Additional required-state JSON files to review.')
		.action(async (id: string, flags: GuidanceFlags) => {
			const report = await guideUnits(id, guidanceOptions(flags));
			console.log(flags.json ? JSON.stringify(report, null, 2) : renderUnitsGuide(report));
			if (report.summary.missing) process.exitCode = 1;
		});
	units
		.command('check-contract [id]')
		.description('Heuristically review props, defaults, errors, outputs and state coverage.')
		.option('--all', 'Review every active stored contract and summarise counts by entity.')
		.option('--json', 'Print structured findings with entity, kind, detail and where.')
		.option('--required-states <paths...>', 'Additional required-state JSON files to review.')
		.action(async (id: string | undefined, flags: GuidanceFlags) => {
			const report = await checkUnitContracts(id, { ...guidanceOptions(flags), all: flags.all });
			console.log(flags.json ? JSON.stringify(report, null, 2) : renderContractCheck(report));
			if (report.summary.findings) process.exitCode = 1;
		});
}

function guidanceOptions(flags: GuidanceFlags): GuidanceOptions {
	return { requiredStates: flags.requiredStates };
}
