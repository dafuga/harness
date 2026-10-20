import type { ReportRepository } from '../repositories/report-repository/ReportRepository';
import { SiteReportRepository } from '../repositories/SiteReportRepository';

/** Everything this server serves or changes comes through here, limited to its own site. */
export const repository: ReportRepository = new SiteReportRepository();

export { reportHttp } from '../routes/api/health/reportHttp';
export { reportFile } from '../routes/api/reports/[id]/[type]/[file]/reportHttp';
