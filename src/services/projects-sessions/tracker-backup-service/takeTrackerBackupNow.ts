// @harness-uid u_3kyltqmxjm
import type { TrackerBackups } from './composeTrackerBackups.types';

export async function takeTrackerBackupNow(backups: TrackerBackups): Promise<Response> {
	const { service } = backups;
	if (!service)
		return Response.json({ error: 'native backups are not enabled on this node' }, { status: 409 });
	return Response.json(await service.take());
}
