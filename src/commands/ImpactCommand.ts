import type { Command } from 'commander';
import { renderImpact, runImpact, type ImpactOptions } from '../workflows/runImpact';

export function registerImpactCommand(program: Command): void {
	program
		.command('impact')
		.option('--base <revision>', 'Revision to compare from.', 'HEAD')
		.option('--head <revision>', 'Revision to compare to; defaults to the working tree.')
		.option('--runtime <kind>', 'Kernel runtime: default, module, wasm, process or http.')
		.option('--json', 'Print structured results.')
		.description('Report the units, tests and scenarios a change affects, across base and head.')
		.action(async (flags: ImpactOptions & { json?: boolean }) => {
			const report = await runImpact(flags);
			console.log(flags.json ? JSON.stringify(report, null, 2) : renderImpact(report));
		});
}
