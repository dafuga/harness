// @harness-uid u_cbc6podcey
import type { TrackerHealthCheck, TrackerHealthStatus } from '../TrackerHealthService.types';

export function trackerHealthBackupChecks(status: TrackerHealthStatus): TrackerHealthCheck[] {
	const { backup } = status;
	if (!backup?.enabled) {
		const detail = 'native backups are not enabled, so they are not checked';
		return [{ name: 'backup', ok: false, severity: 'info', detail }];
	}
	const ok = !backup.stale && !backup.last_error;
	const error = backup.file_error ?? backup.last_error;
	const cause = error ? `: ${error.slice(0, 120)}` : '';
	const detail = ok ? 'ok' : `backup ${backup.stale ? 'stale' : 'failing'}${cause}`;
	return [{ name: 'backup', ok, severity: 'fail', detail }];
}
