import { expect, test } from 'vitest';
import { trackerScheduleHold } from '../../../src/utils/projects-sessions/trackerScheduleHold';

test('a synced pause expires at the opt-out clock, independent of later notes', () => {
	const at = Date.parse('2026-11-28T10:00:00Z');
	const stamp = String(at).padStart(15, '0') + '-000000-mac';
	const row = {
		schedule_off: '1',
		schedule_hold_reason: 'Automatic launch paused by operator',
		created_at: null,
		updated_at: '2026-11-30T10:00:00.000Z',
		clocks: JSON.stringify({ schedule_off: stamp, schedule_hold_reason: stamp })
	};
	expect(trackerScheduleHold(row, at)).toEqual({
		reason: row.schedule_hold_reason,
		until: new Date(at + 86_400_000).toISOString()
	});
	expect(trackerScheduleHold(row, at + 86_400_000)).toBeNull();
	const optedOut = { ...row, schedule_never: '1' };
	expect(trackerScheduleHold(optedOut, at + 86_400_000)).toEqual({
		reason: 'Never auto-launch',
		until: null
	});
	expect(
		trackerScheduleHold({ ...row, clocks: JSON.stringify({ schedule_off: stamp }) }, at)
	).toMatchObject({ reason: 'Legacy automatic launch pause' });
});
