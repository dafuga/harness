import { expect, test } from 'vitest';
import {
	nameNotice,
	phoneName,
	scanFailure,
	scanFailures,
	scanNotices
} from '../../src/utils/scan-notice/scanNotice';

test('each way a scan ends without an offer has words of its own that say how to go on', () => {
	expect(scanFailures).toEqual([
		'camera-denied',
		'camera-unavailable',
		'scan-cancelled',
		'offer-invalid',
		'offer-unsupported',
		'offer-environment',
		'offer-expired'
	]);
	const words = scanFailures.map((code) => scanNotices[code]);
	expect(new Set(words).size).toBe(scanFailures.length);
	for (const text of words) {
		expect(text.length).toBeGreaterThan(20);
		expect(text).not.toMatch(/secret|token|private key|credential|undefined/i);
	}
	expect(scanNotices['camera-denied']).toContain('Settings');
	expect(scanNotices['offer-expired']).toContain('New code');
	expect(scanNotices['scan-cancelled']).toContain('Nothing was sent');
});

test('a failure of the plugin is read by its code; anything else is not a scan failure', () => {
	for (const code of scanFailures)
		expect(scanFailure(Object.assign(new Error('native words'), { code }))).toBe(code);
	expect(scanFailure(new Error('boom'))).toBeNull();
	expect(scanFailure(Object.assign(new Error('no'), { code: 'method-denied' }))).toBeNull();
	expect(scanFailure({ code: 'offer-expired' })).toBe('offer-expired');
	expect(scanFailure('offer-expired')).toBeNull();
	expect(scanFailure(null)).toBeNull();
});

test('a phone is named before it scans: trimmed, and of at most 80 characters', () => {
	expect(phoneName('  Ada iPhone ')).toBe('Ada iPhone');
	expect(phoneName('a'.repeat(80))).toBe('a'.repeat(80));
	expect(phoneName('a'.repeat(81))).toBeNull();
	expect(phoneName('   ')).toBeNull();
	expect(nameNotice).toBe('Give this phone a name of up to 80 characters.');
});
