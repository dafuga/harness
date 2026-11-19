import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	nameNotice,
	scanFailure,
	scanFailures,
	scanNotice
} from '../../src/utils/scan-notice/scanNotice';

const unitId = 'desktop.function.scan-notice';

test('Maps each known scan failure code to its notice', () => {
	const camera = scanNotice({ code: 'camera-denied' });
	const expired = scanNotice(Object.assign(new Error('native words'), { code: 'offer-expired' }));

	expect(camera).toBe('Camera access is off for Harness. Turn it on in Settings, then scan again.');
	expect(expired).toBe('That code has expired. Choose New code on your computer and scan again.');
	expect(scanFailure({ code: 'camera-denied' })).toBe('camera-denied');

	recordExampleCases(
		{
			unitId,
			symbol: 'scanNotice',
			state: 'maps-each-known-scan-failure-code-to-its-notice',
			evidence: 'examples-cases',
			file: 'maps-each-known-scan-failure-code-to-its-notice.json'
		},
		[
			{
				name: 'camera denied object',
				input: { cause: { code: 'camera-denied' } },
				output: camera
			},
			{
				name: 'offer expired error with plugin code',
				input: { cause: 'Error("native words") with code offer-expired' },
				output: expired
			}
		]
	);
});

test('Passes unrecognized causes through as their String form', () => {
	const error = scanNotice(new Error('boom'));
	const unknownCode = scanNotice({ code: 'method-denied' });
	const bareString = scanNotice('offer-expired');
	const nothing = scanNotice(null);
	const missing = scanNotice(undefined);

	expect(error).toBe('Error: boom');
	expect(unknownCode).toBe('[object Object]');
	expect(bareString).toBe('offer-expired');
	expect(nothing).toBe('null');
	expect(missing).toBe('undefined');
	expect(scanFailure(new Error('boom'))).toBeNull();
	expect(scanFailure({ code: 'method-denied' })).toBeNull();
	expect(scanFailure('offer-expired')).toBeNull();
	expect(scanFailure(null)).toBeNull();

	recordExampleCases(
		{
			unitId,
			symbol: 'scanNotice',
			state: 'passes-unrecognized-causes-through-as-their-string-form',
			evidence: 'examples-cases',
			file: 'passes-unrecognized-causes-through-as-their-string-form.json'
		},
		[
			{ name: 'plain error', input: { cause: 'new Error("boom")' }, output: error },
			{
				name: 'unrecognized object code',
				input: { cause: { code: 'method-denied' } },
				output: unknownCode
			},
			{ name: 'bare known code string', input: { cause: 'offer-expired' }, output: bareString },
			{ name: 'null cause', input: { cause: null }, output: nothing },
			{ name: 'undefined cause', input: { cause: 'undefined' }, output: missing }
		]
	);
});

test('Publishes the known codes and the phone naming instruction', () => {
	expect(scanFailures).toEqual([
		'camera-denied',
		'camera-unavailable',
		'scan-cancelled',
		'offer-invalid',
		'offer-unsupported',
		'offer-environment',
		'offer-expired'
	]);
	expect(nameNotice).toBe('Give this phone a name of up to 80 characters.');

	recordExampleCases(
		{
			unitId,
			symbol: 'scanFailures',
			state: 'publishes-the-known-codes-and-the-naming-instruction',
			evidence: 'examples-cases',
			file: 'publishes-the-known-codes-and-the-naming-instruction.json'
		},
		[
			{
				name: 'known scan-failure codes',
				input: { output: 'scanFailures' },
				output: [...scanFailures]
			},
			{ name: 'phone naming instruction', input: { output: 'nameNotice' }, output: nameNotice }
		]
	);
});
