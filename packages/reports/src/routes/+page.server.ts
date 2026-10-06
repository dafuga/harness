import { repository } from '../utils/reportHttp';
export async function load() {
	return { reports: await repository.list() };
}
