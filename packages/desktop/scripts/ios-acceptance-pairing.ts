import { computerName, control, offered, panelText, restart, shot } from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';
import { bundleId, keychainGroups } from './ios-acceptance-simulator';

const phone = 'Acceptance iPhone';
const text = (value: string) => JSON.stringify(value);
const refusal = 'Its relay must be an https:// address.';

/** A Debug product accepts the relay on this machine only when it was started to do so. */
async function optIn(run: Acceptance, link: string): Promise<void> {
	const { record, page } = run;
	await restart(run, false);
	const environment = "return document.documentElement.dataset.environment + ' | ' + panel();";
	const plain = await page.until(environment, 'Connect to computer', 120);
	record.check(plain.startsWith('capacitor'), 'the app starts unpaired, in the Capacitor shell');
	record.check(
		keychainGroups(run.udid).length === 0,
		'before pairing the app keeps nothing in the Keychain of the simulator'
	);
	await page.evaluate(`fill('Pairing link', ${text(link)}); press('Connect'); return 'ok';`);
	const refused = await page.until(panelText, 'https://', 30);
	record.check(
		refused.includes(refusal) && !plain.includes('Debug build for a test fixture'),
		'started without the launch argument, the Debug product refuses the relay on this machine'
	);
	await restart(run);
	const asked = await page.until(panelText, 'Debug build for a test fixture', 120);
	record.check(
		asked.includes('Connect to computer'),
		'started with it, the page states that this is a Debug build for a test fixture'
	);
}

/**
 * TEST ONLY. A real pairing of the app with the fixture computer: pairing over HTTP, a sealed
 * request, the approval, the exchange, the Keychain, the socket with its headers, the handshake
 * and the attach, all by the Swift plugin of the product.
 */
export async function pairing(run: Acceptance): Promise<void> {
	const { record, page } = run;
	record.begin('Pairing with the fixture computer');
	const offer = await offered(run);
	record.check(
		offer.link.startsWith('harnessremote://pair?origin=http%3A%2F%2F127.0.0.1'),
		'the fixture offers a pairing link for its relay on this machine'
	);
	await optIn(run, offer.link);
	const fields = `fill('Pairing link', ${text(offer.link)}), fill('Pairing code', ${text(offer.code)})`;
	const entered = await page.evaluate(
		`return [${fields}, fill('Name of this phone', ${text(phone)}), press('Connect')].join(',');`
	);
	record.check(
		entered === 'true,true,true,true',
		'link, code and name are entered in the form and Connect is pressed'
	);
	const shown = await page.until(panelText, 'Connected to', 120);
	record.check(shown.includes(`Connected to ${computerName}`), 'the page is connected to it');
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
		`return [document.cookie, ${stores}, location.href].join(' | ');`
	);
	record.check(
		record.safe(kept) === kept,
		'the code is in no storage of the page and not in its address'
	);
	record.check(
		keychainGroups(run.udid).join() === bundleId,
		'the pairing is in the real Keychain of the simulator, in the group of the app alone'
	);
	await shot(run, 'paired');
}
