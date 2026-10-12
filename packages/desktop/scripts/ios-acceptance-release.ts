import { linkFields } from './ios-acceptance-guards';
import { control, offered, panelText, pause, restart, shot } from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';

const text = (value: string) => JSON.stringify(value);

/**
 * Asks the Swift plugin itself, past the page. It answers a pairing with the state it is left
 * in: a relay it does not accept leaves it unpaired, with the reason, before anything is sent.
 */
async function askedNatively(run: Acceptance, input: object): Promise<string> {
	const asked = await run.page.evaluate(`
		window.__harnessAnswer = 'waiting';
		if (!window.Capacitor?.nativePromise) return 'no bridge';
		window.Capacitor.nativePromise('HarnessRemote', 'pair', ${JSON.stringify(input)}).then(
			(status) => { window.__harnessAnswer = 'answered: ' + status.state + ' | ' + (status.reason ?? ''); },
			(error) => { window.__harnessAnswer = 'rejected: ' + (error?.message ?? ''); }
		);
		return 'asked';`);
	if (asked !== 'asked') return asked;
	return run.page.until('return String(window.__harnessAnswer);', 'ed: ', 30);
}

/**
 * TEST ONLY. A Release product refuses the relay on this machine. The copy that is tested was
 * made readable for this check and was even given the system's permission for plain http to
 * this machine, so the refusal that is seen is the product's own: in the page and in Swift.
 */
export async function releaseRefusal(run: Acceptance): Promise<void> {
	const { record, page } = run;
	record.begin('Release product');
	const before = await control(run, '/status');
	await restart(run);
	const form = await page.until(panelText, 'Connect to computer', 120);
	record.check(
		!form.includes('Debug build for a test fixture'),
		'a Release product never states a fixture build, whatever it is started with'
	);
	const offer = await offered(run);
	const fields = `fill('Pairing link', ${text(offer.link)}), fill('Pairing code', ${text(offer.code)})`;
	await page.evaluate(`return [${fields}, press('Connect')].join(',');`);
	const refused = await page.until(panelText, 'https://', 30);
	record.check(
		refused.includes('Its relay must be an https:// address.'),
		'the page refuses the relay on this machine and says why'
	);
	const input = { ...linkFields(offer.link), code: offer.code, deviceName: 'Release iPhone' };
	const native = await askedNatively(run, input);
	record.check(
		native === 'answered: unpaired | The relay of this link is not an https address.',
		'asked directly, the Swift plugin of the Release product refuses it and stays unpaired'
	);
	await pause(4000);
	const after = await control(run, '/status');
	record.check(
		after.requests.length === 0 && after.devices.length === before.devices.length,
		'nothing reached the relay or the computer: no request and no new phone'
	);
	await page.evaluate("fill('Pairing code', ''); return 'ok';");
	await shot(run, 'release-refusal');
}
