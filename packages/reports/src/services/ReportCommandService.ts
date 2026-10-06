import { ReportRepository } from '../repositories/ReportRepository';
import { ReportExportService } from './ReportExportService';
import { ReportImportService } from './ReportImportService';
import { ReportServerService } from './ReportServerService';
import { ReportRetentionService } from './ReportRetentionService';
import { ReportStorageSyncService } from './ReportStorageSyncService';
import { ReportPublishService } from './ReportPublishService';
import { reportCli, inputData, required } from '../utils/reportCli';
import type { BeginInput, RecordInput } from '../models/Report.types';
export class ReportCommandService {
	constructor(private readonly repository = new ReportRepository()) {}
	async execute(argv: string[]) {
		const { operation, flags } = reportCli(argv);
		if (operation === 'begin') return this.begin(flags);
		if (operation === 'record')
			return this.repository.record(required(flags, 'run'), {
				kind: required(flags, 'kind') as RecordInput['kind'],
				data: await inputData(flags)
			});
		if (operation === 'finalize') {
			return new ReportExportService(this.repository).finalize(required(flags, 'run'));
		}
		if (operation === 'import') return this.import(flags);
		if (operation === 'publish')
			return new ReportPublishService(this.repository).publish(required(flags, 'run'));
		if (operation === 'serve')
			return new ReportServerService(this.repository).serve(Number(flags.port) || 5588);
		if (['cleanup', 'sync-storage'].includes(operation)) return this.storage(operation, flags);
		throw new Error(
			'Usage: report <begin|record|finalize|import|publish|serve|cleanup|sync-storage> [options]'
		);
	}
	private storage(operation: string, flags: Record<string, string | boolean>) {
		const options = {
			run: flags.run ? String(flags.run) : undefined,
			dryRun: Boolean(flags['dry-run'])
		};
		const service =
			operation === 'cleanup'
				? new ReportRetentionService(this.repository)
				: new ReportStorageSyncService(this.repository);
		return service.run(options);
	}

	private begin(flags: Record<string, string | boolean>) {
		const acceptance = flags.acceptance ? (JSON.parse(String(flags.acceptance)) as string[]) : [];
		const input: BeginInput = {
			project: required(flags, 'project'),
			title: required(flags, 'title'),
			mode: required(flags, 'mode') as 'feature' | 'suite',
			environment: required(flags, 'environment'),
			revision: flags.revision ? String(flags.revision) : undefined,
			summary: flags.summary ? String(flags.summary) : undefined,
			historical: Boolean(flags.historical),
			acceptance
		};
		return this.repository.begin(input);
	}
	private async import(flags: Record<string, string | boolean>) {
		const format = required(flags, 'format'),
			file = required(flags, 'file');
		let id = flags.run ? String(flags.run) : '';
		if (!id) {
			if (format !== 'mira') throw new Error('--run is required for this import format');
			const run = await this.repository.begin({
				project: required(flags, 'project'),
				title: String(flags.title || 'Mira production playthrough - historical'),
				mode: 'suite',
				environment: String(flags.environment || 'production / historical'),
				revision: flags.revision ? String(flags.revision) : undefined,
				historical: true,
				summary:
					'Historical production playthrough. Seven of twenty requested scenes were recorded; outstanding issues remain.'
			});
			id = run.id;
		}
		const result = await new ReportImportService(this.repository).ingest(
			format,
			id,
			file,
			flags.findings ? String(flags.findings) : undefined
		);
		return { run: id, ...result };
	}
}
