/** @pure */
export function formatDuration(seconds?: number): string {
	if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
	const total = Math.floor(seconds);
	const minute = Math.floor(total / 60);
	const remainder = String(total % 60).padStart(2, '0');
	return minute < 60
		? `${minute}:${remainder}`
		: `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}:${remainder}`;
}
