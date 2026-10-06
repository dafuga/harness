import { error, json } from '@sveltejs/kit';
import { repository } from '../../../../utils/reportHttp';
export async function GET({ params }: { params: { id: string } }) {
	try {
		return json(await repository.get(params.id), { headers: { 'Cache-Control': 'no-store' } });
	} catch {
		error(404, 'Report not found');
	}
}
