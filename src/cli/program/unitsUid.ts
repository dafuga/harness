// @harness-uid u_ttba2jnp37
import type { Command } from 'commander';
import { renameUnit } from '../../workflows/development-tooling/rename-unit/renameUnit';
import { backfillUids } from '../../workflows/development-tooling/backfill-uids/backfillUids';
import type { BackfillReport } from '../../workflows/development-tooling/backfill-uids/backfillUids.types';

interface UidFlags {
	write?: boolean;
	json?: boolean;
}

export function registerUnitsUid(units: Command): void {
	units
		.command('uid-backfill')
		.option('--write', 'Write the uids to the registry and the source files.')
		.option('--json', 'Print structured results.')
		.description('Give every unit a stable uid, keeping its id, contract and history.')
		.action(async (flags: UidFlags) => {
			const report = await backfillUids({ write: flags.write });
			console.log(flags.json ? JSON.stringify(report, null, 2) : renderBackfill(report, flags));
		});
}

export function registerUnitsRename(units: Command): void {
	units
		.command('rename <id> <newId>')
		.description('Give a unit another id; its uid, contract and history stay with it.')
		.action(async (id: string, newId: string) => {
			const report = await renameUnit(id, newId);
			console.log(
				`Renamed ${report.from} to ${report.to}; ${report.rewritten.length} specification files updated.`
			);
		});
}

function renderBackfill(report: BackfillReport, flags: UidFlags): string {
	const lines = [
		`${report.units} units: ${report.assigned.length} given a uid, ${report.annotated.length} source files annotated, ${report.registryOnly.length} kept in the registry only.`,
		...report.conflicts.map((item) => `  conflict ${item.id}: ${item.reason}`)
	];
	if (!flags.write && (report.assigned.length || report.annotated.length))
		lines.push('Run again with --write to apply.');
	return lines.join('\n');
}
