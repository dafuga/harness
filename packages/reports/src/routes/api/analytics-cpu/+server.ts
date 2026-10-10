import { json } from '@sveltejs/kit';
import { CpuUsageService } from '../../../../../../src/services/CpuUsageService';
import { siteProcesses } from '../../../utils/siteProcesses';
const service = new CpuUsageService();
export async function GET({ url }: { url: URL }): Promise<Response> {
	if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
		return json({ status: 'unavailable' }, { status: 403 });
	const snapshot = siteProcesses(await service.snapshot());
	return json(snapshot, {
		headers: { 'cache-control': 'no-store' },
		status: snapshot.status === 'available' ? 200 : 503
	});
}
