import type { Report } from '../models/Report.types';
import { ownedBySite } from '../utils/reportSite';
import { ReportRepository } from "./report-repository/ReportRepository";

/**
 * The report store as one site may see it. A report recorded for another application is as
 * absent as one that does not exist: it is not listed, read, served, exported or changed.
 * Every read and every write of the base repository goes through `get`, so this is the one
 * place where the boundary is drawn.
 */
export class SiteReportRepository extends ReportRepository {
	async get(id: string): Promise<Report> {
		const run = await super.get(id);
		if (!ownedBySite(run.project)) throw new Error('ENOENT: no such report on this site');
		return run;
	}
}
