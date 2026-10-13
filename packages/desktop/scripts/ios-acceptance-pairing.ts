import {
	computerName,
	control,
	offered,
	panelText,
	pause,
	restart,
	scanPressed,
	shot
} from './ios-acceptance-run';
import type { Acceptance, PairingOffer } from './ios-acceptance-run';
import { bundleId, keychainGroups } from './ios-acceptance-simulator';

const phone = 'Acceptance iPhone';
const refusal = 'That code is for a relay this build of Harness does not accept.';
/** The panel once the phone is neither asking nor waiting any more; empty until then. */
const settled =
	"const now = panel(); return /Contacting|Waiting for approval/.test(now) ? '' : now;";

/** A Debug product asks the relay on this machine only when it was started to do so. */
async function optIn(run: Acceptance, offer: PairingOffer): Promise<void> {
	const { record, page } = run;
	await restart(run, false, [offer.scan]);
	const environment = "return document.documentElement.dataset.environment + ' | ' + panel();";
	const plain = await page.until(environment, 'Connect to computer', 120);
	record.check(plain.startsWith('capacitor'), 'the app starts unpaired, in the Capacitor shell');
	record.check(
		plain.includes('Scan QR code') && !/Pairing link|Pairing code/.test(plain),
		'it offers Scan QR code and has no field for a link, a code or an address'
	);
	record.check(
		keychainGroups(run.udid).length === 0,
		'before pairing the app keeps nothing in the Keychain of the simulator'
	);
	await scanPressed(run, phone);
	const refused = await page.until(panelText, 'does not accept', 30);
	record.check(
		refused.includes(refusal) && !plain.includes('Debug build for a test fixture'),
		'started without the launch argument, the Debug product does not ask the relay on this machine'
	);
	const { requests } = await control(run, '/status');
	record.check(requests.length === 0, 'and nothing reached the computer');
}

/** A scanned offer is a request and nothing more, for as long as nobody approves it. */
async function waits(run: Acceptance, offer: PairingOffer): Promise<void> {
	const { record, page } = run;
	await restart(run, true, [offer.scan, offer.scan]);
	const asked = await page.until(panelText, 'Debug build for a test fixture', 120);
	record.check(
		asked.includes('Connect to computer'),
		'started with it, the page states that this is a Debug build for a test fixture'
	);
	await scanPressed(run, phone);
	await page.until(panelText, 'Waiting for approval', 60);
	const first = await control(run, '/status');
	record.check(
		first.requests.length === 1 && first.requests[0].deviceName === phone,
		'the scan made exactly this phone a request on the computer'
	);
	await pause(7000);
	const still = await page.evaluate(panelText);
	const { devices } = await control(run, '/status');
	record.check(
		still.includes('Waiting for approval') && !still.includes('Connected to') && !devices.length,
		'the scan alone connects nothing: the phone waits and the computer lists no phone'
	);
	record.check(
		keychainGroups(run.udid).length === 0,
		'while it waits the app keeps nothing in the Keychain'
	);
	await shot(run, 'pending-approval');
}

/** Denied on the computer, the phone is unpaired; the same code, scanned again, pairs nobody. */
async function deniedAndSpent(run: Acceptance): Promise<void> {
	const { record, page } = run;
	await control(run, '/deny');
	const denied = await page.until(panelText, 'declined on your computer', 60);
	record.check(denied.includes('Connect to computer'), 'denied on the computer, it says so');
	await scanPressed(run);
	await pause(1500);
	const again = await page.until(settled, 'Connect to computer', 60);
	const { requests, devices } = await control(run, '/status');
	record.check(
		!again.includes('Connected to') && requests.length === 0 && devices.length === 0,
		'the denied code, scanned again, pairs nobody: no request and no phone on the computer'
	);
	record.check(keychainGroups(run.udid).length === 0, 'and the Keychain is still empty');
}

/**
 * TEST ONLY. A real pairing of the app with the fixture computer, begun by a scan: the offer is
 * read by the Swift of the product, the request is sealed, a person's approval is stood in for
 * by the control of the fixture, and only then the exchange, the Keychain, the socket with its
 * headers, the handshake and the attach happen. The scan itself comes from the synthetic
 * scanner of the test copy; no camera was used.
 */
export async function pairing(run: Acceptance): Promise<void> {
	const { record, page } = run;
	record.begin('Pairing with the fixture computer by scanning');
	const first = await offered(run);
	await optIn(run, first);
	await waits(run, first);
	await deniedAndSpent(run);
	const second = await offered(run);
	await restart(run, true, [second.scan]);
	await page.until(panelText, 'Connect to computer', 120);
	await scanPressed(run, phone);
	await page.until(panelText, 'Waiting for approval', 60);
	await control(run, '/approve');
	const shown = await page.until(panelText, 'Connected to', 120);
	record.check(shown.includes(`Connected to ${computerName}`), 'approved, the page is connected');
	record.check(
		shown.includes(phone) && shown.includes('Key '),
		'the phone shows its own name and the identity of its key'
	);
	const { devices } = await control(run, '/status');
	record.check(
		devices.length === 1 && devices[0].online && devices[0].name === phone,
		'the computer lists exactly this phone as approved and online'
	);
	const key = (shown.split('Key ')[1] ?? '').split('\n')[0].replace(/\s/g, '');
	record.check(
		key.length === 40 && devices[0]?.deviceId === key,
		'the identity the phone shows is the identity the computer approved'
	);
	const stores = '...Object.values(localStorage), ...Object.values(sessionStorage)';
	const kept = await page.evaluate(
		`return [document.cookie, ${stores}, location.href, document.body.innerText].join(' | ');`
	);
	record.check(
		record.safe(kept) === kept,
		'neither the code nor the QR text is in the page, its storage or its address'
	);
	record.check(
		keychainGroups(run.udid).join() === bundleId,
		'the pairing is in the real Keychain of the simulator, in the group of the app alone'
	);
	await shot(run, 'paired');
}
