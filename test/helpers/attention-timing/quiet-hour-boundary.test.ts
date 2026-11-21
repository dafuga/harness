import { expect, test } from 'vitest';
import { quietHourBoundary } from '../../../src/helpers/attention-timing/quietHourBoundary';

const LISBON = { tz: 'Europe/Lisbon', start: '22:00', end: '08:00' };
const at = (iso: string) => Date.parse(iso);

test('quietHourBoundary holds a night instant to 08:00 the next morning', () => {
	expect(quietHourBoundary(at('2026-11-16T23:30:00Z'), LISBON)).toBe(at('2026-11-17T08:00:00Z'));
});

test('quietHourBoundary holds an early-morning instant to 08:00 the same day', () => {
	expect(quietHourBoundary(at('2026-11-17T03:00:00Z'), LISBON)).toBe(at('2026-11-17T08:00:00Z'));
});

test('quietHourBoundary returns the instant itself outside quiet hours and without quiet hours', () => {
	expect(quietHourBoundary(at('2026-11-17T10:00:00Z'), LISBON)).toBe(at('2026-11-17T10:00:00Z'));
	expect(quietHourBoundary(at('2026-11-16T23:30:00Z'), null)).toBe(at('2026-11-16T23:30:00Z'));
});
