import { json } from '@sveltejs/kit';
import { repository } from '../../../utils/reports-media/reportHttp';
export async function GET() {
	return json(await repository.list(), { headers: { 'Cache-Control': 'no-store' } });
}
