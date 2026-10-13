import { expiredOffer, otherVersion } from './ios-acceptance-guards';
import { control, offered, panelText, restart, scanPressed, shot } from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';
import { cameraAccess, keychainGroups } from './ios-acceptance-simulator';

const phone = 'Acceptance iPhone';
const methodNames =
	"return ((window.Capacitor?.PluginHeaders ?? []).find((item) => item.name === 'HarnessRemote')?.methods ?? []).map((item) => item.name).join(',');";

/**
 * TEST ONLY, on the copy with the synthetic scanner. Every way a scan ends without an offer says
 * what happened, offers another scan, and reaches nobody: no request arrives at the computer.
 */
export async function scanEndings(run: Acceptance): Promise<void> {
	const { record, page } = run;
	record.begin('Scans that are no offer');
	const offer = await offered(run);
	const endings: [string, string, string][] = [
		['denied', 'Camera access is off for Harness', 'refused camera access is said as that'],
		['cancelled', 'Scanning was cancelled', 'a cancelled scan says that nothing was sent'],
		['https://example.com/', 'not a Harness pairing code', 'another QR code is not an offer'],
		[expiredOffer(offer.scan), 'That code has expired', 'the offer past its time is expired'],
		[otherVersion(offer.scan), 'another version of Harness', 'another version is unsupported'],
		['unavailable', 'no camera that can scan', 'a device without a camera says so']
	];
	await restart(
		run,
		true,
		endings.map(([scan]) => scan)
	);
	await page.until(panelText, 'Connect to computer', 120);
	for (const [index, [, words, name]] of endings.entries()) {
		const pressed = await scanPressed(run, index === 0 ? phone : undefined);
		const said = await page.until(panelText, words, 30);
		const stayed = pressed === 'true' && said.includes('Scan again');
		record.check(
			stayed && !said.includes('Waiting for approval'),
			`${name}, and can be tried again`
		);
	}
	const { requests, devices } = await control(run, '/status');
	record.check(
		requests.length === 0 && devices.length === 0,
		'none of these scans reached the computer: no request and no phone'
	);
	record.check(keychainGroups(run.udid).length === 0, 'and the app kept nothing in the Keychain');
	await shot(run, 'scan-refused');
}

/**
 * TEST ONLY, on a product of the real source. It is started with everything that makes the
 * synthetic copy scan, and still has only its camera: on a simulator, which has none, a scan
 * finds no camera, and a refused camera is said as that. Nothing reaches the computer.
 */
export async function cameraOnly(run: Acceptance, product: string): Promise<void> {
	const { record, page } = run;
	const offer = await offered(run);
	cameraAccess(run.udid, 'grant');
	await restart(run, true, [offer.scan]);
	await page.until(panelText, 'Connect to computer', 120);
	const methods = (await page.evaluate(methodNames)).split(',');
	record.check(
		methods.includes('scan') && !methods.includes('pair'),
		`the plugin of the ${product} product offers a scan and no way to be handed pairing values`
	);
	await scanPressed(run, phone);
	const none = await page.until(panelText, 'no camera', 30);
	record.check(
		none.includes('This device has no camera that can scan a code.'),
		`given the synthetic scan argument, the ${product} product still scans with its camera only`
	);
	cameraAccess(run.udid, 'revoke');
	await restart(run, true, [offer.scan]);
	await page.until(panelText, 'Connect to computer', 120);
	await scanPressed(run, phone);
	const refused = await page.until(panelText, 'Camera access is off', 30);
	record.check(
		refused.includes('Turn it on in Settings'),
		`the ${product} product asks the system for its camera and says when that is refused`
	);
	const { requests, devices } = await control(run, '/status');
	record.check(
		requests.length === 0 && devices.length === 0,
		`nothing of the ${product} product reached the computer: no request and no phone`
	);
	await shot(run, `camera-only-${product.toLowerCase()}`);
}
