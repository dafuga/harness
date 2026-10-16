import { expect, test } from 'vitest';
import { EventLogService } from '../../src/services/EventLogService';

const epoch = 'e'.repeat(32);
function filled(count: number, capacity?: number) {
	const log = new EventLogService({ epoch, capacity });
	for (let index = 1; index <= count; index++) log.append('run', { n: index });
	return log;
}
const sequences = (log: EventLogService, sequence: number, from = epoch) =>
	log.since({ epoch: from, sequence }).events.map((event) => event.sequence);

test('events get one increasing sequence across channels', () => {
	const log = new EventLogService({ epoch });
	expect(log.append('run', { a: 1 })).toEqual({
		type: 'event',
		channel: 'run',
		sequence: 1,
		value: { a: 1 }
	});
	expect(log.append('connection', { b: 2 }).sequence).toBe(2);
	expect(log.sequence).toBe(2);
});
test('a resume point inside the retained window replays what followed it', () => {
	const log = filled(5);
	expect(log.since({ epoch, sequence: 3 }).replay).toBe('resumed');
	expect(sequences(log, 3)).toEqual([4, 5]);
	expect(log.since({ epoch, sequence: 5 })).toEqual({ replay: 'resumed', events: [] });
	expect(log.since(null)).toEqual({ replay: 'none', events: [] });
});
test('another epoch, a future sequence or a trimmed window is a gap', () => {
	const log = filled(5, 3);
	expect(sequences(log, 2)).toEqual([3, 4, 5]);
	expect(log.since({ epoch, sequence: 1 })).toEqual({ replay: 'gap', events: [] });
	expect(log.since({ epoch: 'f'.repeat(32), sequence: 4 })).toEqual({ replay: 'gap', events: [] });
	expect(log.since({ epoch, sequence: 9 })).toEqual({ replay: 'gap', events: [] });
});
test('each log has its own random epoch', () => {
	const log = new EventLogService();
	expect(log.epoch).toMatch(/^[a-f0-9]{32}$/);
	expect(new EventLogService().epoch).not.toBe(log.epoch);
});
