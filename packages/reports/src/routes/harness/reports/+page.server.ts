import { repository } from '../../../utils/reportHttp';
import { reportSite } from '../../../utils/reportSite';
export async function load() {
	return { reports: await repository.list(), site: reportSite().name };
}
