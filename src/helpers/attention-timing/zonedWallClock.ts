// @harness-uid u_r6mrd6gy5y
import type { WallClock } from './attentionTiming.types';

/** @pure Read the wall-clock fields an epoch instant shows in a time zone (hour 0-23). */
export function zonedWallClock(atMs: number, tz: string): WallClock {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(new Date(atMs));
	const field = (type: string): number =>
		Number(parts.find((part) => part.type === type)?.value) || 0;
	return {
		year: field('year'),
		month: field('month'),
		day: field('day'),
		hour: field('hour') % 24,
		minute: field('minute'),
		second: field('second')
	};
}
