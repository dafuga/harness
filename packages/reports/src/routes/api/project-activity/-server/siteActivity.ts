import { ProjectActivityService } from '../../../../../../../src/services/project-activity-service/ProjectActivityService';
import type { Shown } from '../../../../../../../src/workflows/runActivity';
import { reportSite } from '../../../../utils/reportSite';

/** Newest commits a page shows. */
const commits = 20;

/**
 * The activity of the application this server is hosted for, read when asked: its committed
 * work from Git, what is not committed in its checkouts and its registered agents. The site is
 * fixed by the server, so no request can ask for another repository. Undefined when it cannot
 * be read, which a page says instead of showing nothing.
 */
export async function siteActivity(): Promise<Shown | undefined> {
	try {
		return await new ProjectActivityService(reportSite().root).show(commits);
	} catch {
		return undefined;
	}
}
