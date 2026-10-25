import type { Command } from 'commander';
import type { ValidateOptions } from './ValidateCommand.types';
import type {
	ValidationReport,
	HistoryValidationReport
} from '../../services/git-source-history/ModuleDataService.types';
import { ModuleDataService } from '../../services/git-source-history/ModuleDataService';
/** Keep validation and repair usable even when incomplete data blocks normal resource reads. */
export class ValidateCommand {
	register(program: Command): void {
		program
			.command('validate [id]')
			.description('Validate committed module data and list every missing field.')
			.option('--module <id>', 'Validate one registered module.')
			.option('--type <kind>', 'Validate one kind or catalog category, such as component or pages.')
			.option('--commit <revision>', 'Validate this exact Git revision (default HEAD).')
			.option('--all', 'With --history, include every source branch and archived source commit.')
			.option('--history', 'Validate all ancestors of the selected revision.')
			.option('--write', 'Commit derived facts and gap reports to refs/harness/module-data.')
			.option('--review <json-file>', 'Commit source-bound authored metadata; requires --write.')
			.option('--refresh', 'Recheck source and evidence instead of using cached results.')
			.option('--sync <remote>', 'Exchange committed metadata with a configured Git remote.')
			.option('--json', 'Print the complete machine-readable report.')
			.action(runValidation);
	}
}
function render(report: ValidationReport | HistoryValidationReport): string {
	if ('revisions' in report)
		return report.revisions
			.map(
				(item) =>
					`${item.commit}: ${item.valid ? 'valid' : 'incomplete'}; ${item.missingModules}/${item.moduleCount} modules missing data, ${item.issueCount} gaps. harness validate --commit ${item.commit}`
			)
			.join('\n');
	return [
		`${report.commit}: ${report.valid ? 'metadata valid' : 'metadata incomplete'}; ${report.evidenceGaps} evidence gaps (${report.modules.length} modules, ${report.cached ? 'cached' : 'scanned'}, ${report.committed ? 'committed' : 'not committed'})`,
		...report.issues,
		...report.modules
			.filter((unit) => unit.issues.length)
			.flatMap((unit) => [
				`${unit.id} (${unit.kind})`,
				...unit.issues.map(
					(issue) =>
						`  ${issue.kind ?? 'metadata'}: ${issue.field}: ${issue.message} ${issue.repair}`
				)
			])
	].join('\n');
}

async function runValidation(id: string | undefined, options: ValidateOptions) {
	checkModuleScope(id, options.module);
	checkHistoryScope(options);
	const service = new ModuleDataService(process.cwd()),
		scope = { ...options, module: options.module ?? id };
	if (options.sync) await service.sync(options.sync);
	const report = options.history ? await service.history(scope) : await service.validate(scope);
	console.log(options.json ? JSON.stringify(report, null, 2) : render(report));
	if (options.sync && options.write) await service.sync(options.sync);
	if (!report.valid) process.exitCode = 1;
}

function checkModuleScope(id?: string, module?: string) {
	if (id && module && id !== module) throw new Error('Choose one module.');
}

function checkHistoryScope(options: ValidateOptions) {
	if (!options.all) return;
	if (!options.history) throw new Error('--all requires --history.');
	if (options.commit) throw new Error('Choose --all or --commit.');
}
