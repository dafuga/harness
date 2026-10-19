import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reportRuntimeRoot } from '../utils/reportRuntimeRoot';
import type { Report, Exports } from '../models/Report.types';
import { ReportRepository } from '../repositories/ReportRepository';
import { ReportExportSerializer } from '../serializers/ReportExportSerializer';
import { reportLock } from '../utils/reportLock';
import { registeredAsset } from '../utils/reportAssets';
import { reportProcess } from '../utils/reportProcess';
import { reportPdf } from '../utils/reportPdf';
const appRoot = reportRuntimeRoot();
export class ReportExportService {
	constructor(private readonly repository = new ReportRepository()) {}
	async finalize(id: string) {
		const directory = this.repository.directory(id);
		const lockDirectory = join(directory, 'export-lock');
		await mkdir(lockDirectory, { recursive: true, mode: 0o700 });
		return reportLock(lockDirectory, async () => this.build(id, directory));
	}
	async rebuildAfterRetention(report: Report, directory: string) {
		if (report.state !== 'finalized' || !report.exports)
			throw new Error('Only finalized reports with exports can be rebuilt');
		await this.render(report, directory, report.exports);
	}
	private async build(id: string, directory: string) {
		const report = await this.repository.seal(id);
		const exports = { html: 'index.html', pdf: 'report.pdf', zip: 'report.zip' };
		const ready: Report = { ...report, state: 'finalized', exports };
		await this.render(ready, directory, exports);
		return this.repository.finish(id, exports);
	}
	private async render(report: Report, directory: string, exports: Exports) {
		const target = join(directory, 'exports');
		await mkdir(target, { recursive: true, mode: 0o700 });
		await this.copyAssets(report, directory, target);
		const html = await new ReportExportSerializer(appRoot).html(report, directory);
		await writeFile(join(target, exports.html), html, { mode: 0o600 });
		const manifest = join(target, 'manifest.json');
		await writeFile(manifest, JSON.stringify(report, null, 2), { mode: 0o600 });
		const pdf = await reportProcess(
			reportPdf(),
			[
				join(appRoot, 'scripts', 'build_pdf.py'),
				manifest,
				join(target, exports.pdf),
				join(directory, 'assets')
			],
			appRoot
		);
		if (pdf.code !== 0) throw new Error(`PDF export failed: ${pdf.output.slice(-2000)}`);
		const zip = await reportProcess(
			reportPdf(),
			[join(appRoot, 'scripts', 'build_zip.py'), manifest, target, join(target, exports.zip)],
			appRoot
		);
		if (zip.code !== 0) throw new Error(`ZIP export failed: ${zip.output.slice(-2000)}`);
	}
	private async copyAssets(report: Report, directory: string, target: string) {
		await mkdir(join(target, 'assets'), { recursive: true, mode: 0o700 });
		for (const item of report.evidence) {
			if (item.missing) continue;
			const source = await registeredAsset(
				join(directory, 'assets'),
				item.file,
				report.evidence.map((value) => value.file)
			);
			await copyFile(source, join(target, 'assets', item.file));
		}
	}
}
