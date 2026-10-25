import { expect, test } from 'vitest';
import { EventLogService } from '../../src/services/EventLogService';

// Declared states of one log: initialized (nothing appended), recorded (events kept, none
// dropped) and trimmed (the window dropped its oldest events). Each case names one state.
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
test('sequence of an initialized log is zero', () => {
	expect(new EventLogService({ epoch }).sequence).toBe(0);
});
test('sequence counts the events a recorded log keeps', () => {
	expect(filled(5).sequence).toBe(5);
});
test('sequence keeps counting after the window drops its oldest events', () => {
	expect(filled(5, 3).sequence).toBe(5);
});
test('append to a recorded log continues the sequence and stays replayable', () => {
	const log = filled(2);
	expect(log.append('cache', { n: 3 })).toEqual({
		type: 'event',
		channel: 'cache',
		sequence: 3,
		value: { n: 3 }
	});
	expect(log.sequence).toBe(3);
	expect(sequences(log, 0)).toEqual([1, 2, 3]);
});
test('append to a trimmed log drops the oldest retained event', () => {
	const log = filled(5, 3);
	expect(log.append('run', { n: 6 })).toEqual({
		type: 'event',
		channel: 'run',
		sequence: 6,
		value: { n: 6 }
	});
	expect(sequences(log, 3)).toEqual([4, 5, 6]);
	expect(log.since({ epoch, sequence: 2 })).toEqual({ replay: 'gap', events: [] });
});
test('a resume on an initialized log replays nothing or is a gap', () => {
	const log = new EventLogService({ epoch });
	expect(log.since(null)).toEqual({ replay: 'none', events: [] });
	expect(log.since({ epoch, sequence: 0 })).toEqual({ replay: 'resumed', events: [] });
	expect(log.since({ epoch, sequence: 1 })).toEqual({ replay: 'gap', events: [] });
	expect(log.since({ epoch: 'f'.repeat(32), sequence: 0 })).toEqual({ replay: 'gap', events: [] });
});
