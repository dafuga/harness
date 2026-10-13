import { panelText, restart } from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';
import { cameraOnly } from './ios-acceptance-scanning';

/**
 * TEST ONLY. A Release product of the real source. The copy that is tested was made readable
 * for this check and was even given the system's permission for plain http to this machine. It
 * states no fixture build, and it can be handed a pairing code by nothing but its camera: the
 * launch arguments of the test copy mean nothing to it. That a Release build refuses the offer
 * of a relay on this machine is proven where its Swift runs on the Mac (`ios:check:native`),
 * not here: a simulator has no camera to show it one.
 */
export async function releaseRefusal(run: Acceptance): Promise<void> {
	const { record, page } = run;
	record.begin('Release product');
	await restart(run);
	const form = await page.until(panelText, 'Connect to computer', 120);
	record.check(
		!form.includes('Debug build for a test fixture'),
		'a Release product never states a fixture build, whatever it is started with'
	);
	record.check(
		form.includes('Scan QR code') && !/Pairing link|Pairing code/.test(form),
		'it offers Scan QR code and has no field for a link, a code or an address'
	);
	await cameraOnly(run, 'Release');
}
