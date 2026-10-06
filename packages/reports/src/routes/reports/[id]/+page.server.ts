import { error } from '@sveltejs/kit';
import { repository } from '../../../utils/reportHttp';
export async function load({ params }: { params: { id: string } }) {
	try {
		return { report: await repository.get(params.id) };
	} catch {
		error(404, 'Report not found');
	}
}
