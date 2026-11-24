// @harness-uid u_fppws53qsn
import {
	type FixtureView,
	type Acceptance,
	type PairingOffer,
	FixtureControlOriginError,
	FixtureControlRefusedError
} from './ios-acceptance-run.types';
import { resolve } from 'node:path';
import { fixtureOverview } from '../tests/e2e/support/projectOverviewNativeFixture';
import { localOrigin, loopbackArgument, scanArgument } from './ios-acceptance-guards';
import { launch, screenshot } from './ios-acceptance-simulator';

export const computerName = 'Harness fixture computer';
export const panelText = 'return panel();';
export const footerText = 'return footer();';
export const pause = (milliseconds: number) =>
	new Promise((done) => setTimeout(done, milliseconds));

/** One operation of the fixture's control. Refused unless that control is on this machine. */
export async function control<T = FixtureView>(
	run: Acceptance,
	path: string,
	body?: object
): Promise<T> {
	if (!localOrigin(run.controlOrigin))
		throw new FixtureControlOriginError('The control of the fixture is not on this machine.');
	const sent = body && {
		body: JSON.stringify(body),
		headers: { 'content-type': 'application/json' }
	};
	const method = path === '/status' ? 'GET' : 'POST';
	const response = await fetch(run.controlOrigin + path, { method, ...sent });
	if (!response.ok)
		throw new FixtureControlRefusedError(`The fixture refused ${path} (${response.status}).`);
	return (await response.json()) as T;
}

/** A new one-time offer of the fixture; code and QR text are hidden from all the run writes. */
export async function offered(run: Acceptance): Promise<PairingOffer> {
	const offer = await control<PairingOffer>(run, '/pairing');
	run.record.hide(offer.code);
	run.record.hide(offer.scan);
	return offer;
}

/**
 * Starts the app again and forgets the page of the one that ran. `scans` is what the scans of
 * this launch answer, in order; only the TEST ONLY scan fixture copy understands it.
 */
export async function restart(
	run: Acceptance,
	fixture = true,
	scans: string[] = []
): Promise<void> {
	await run.page.reset();
	const answers = scans.length ? [scanArgument, scans.join('|')] : [];
	launch(run.udid, [...(fixture ? [loopbackArgument] : []), ...answers]);
	await prepareOwnerFixture(run);
}

/** The real paired phone stays connected. Only its Hub account reply is synthetic. */
const overviewAccount = (snapshot: Awaited<ReturnType<typeof fixtureOverview>>) => `
const cap = window.Capacitor;
if (!cap.isNativePlatform() || !cap.isPluginAvailable('HarnessAccount')) return 'unavailable';
const native = cap.nativePromise;
const fixture = { calls: [], denied: false, restore: () => { cap.nativePromise = native; } };
window.harnessOverviewAcceptance = fixture;
cap.nativePromise = (plugin, method, options) => {
	if (plugin !== 'HarnessAccount') return native.call(cap, plugin, method, options);
	if (method === 'status') return Promise.resolve({
		configured: true, state: 'signed-in',
		actor: { id: 'google-fixture-owner', name: 'Fixture Owner', email: 'owner@example.invalid' }
	});
	fixture.calls.push(options);
	const overview = options?.path === '/api/tracker-overview';
	const status = overview && fixture.denied ? 403 : 200;
	const body = overview ? (fixture.denied ? {} : ${JSON.stringify(snapshot)}) : [];
	return Promise.resolve({ status, contentType: 'application/json', data: btoa(JSON.stringify(body)) });
};
window.dispatchEvent(new Event('focus'));
return 'ready';`;

async function prepareOwnerFixture(run: Acceptance): Promise<void> {
	await run.page.until(
		"return String(window.Capacitor?.isNativePlatform() && window.Capacitor.isPluginAvailable('HarnessAccount'));",
		'true'
	);
	const ready = await run.page.evaluate(overviewAccount(await fixtureOverview()));
	run.record.check(ready === 'ready', 'the isolated test copy uses the synthetic Hub owner');
}

/** Names the phone when asked to, and presses the scan button, whatever it is called now. */
export function scanPressed(run: Acceptance, name?: string): Promise<string> {
	const named = name ? `fill('Name of this phone', ${JSON.stringify(name)}) && ` : '';
	return run.page.evaluate(
		`return String(${named}(press('Scan QR code') || press('Scan again')));`
	);
}

/** A screenshot of the simulator, once the page had time to paint what was just asked of it. */
export async function shot(run: Acceptance, name: string): Promise<void> {
	await pause(900);
	screenshot(run.udid, resolve(run.output, `${name}.png`));
}

/** Opens the synthetic project and its design entity, and waits for the image to be there. */
export async function openDesign(run: Acceptance): Promise<string> {
	const { page, project } = run;
	const open = JSON.stringify(`Open ${project.name}`);
	await page.until(
		`if (press(${open})) return 'project control pressed';
return JSON.stringify({
	root: location.pathname === '/',
	overview: location.pathname === '/projects',
	connected: panel().includes('Connected to'),
	recentProjects: document.querySelectorAll('.recent-projects button').length
});`,
		'project control pressed'
	);
	await page.until('return document.title;', project.name);
	await page.until(
		"return press('Open Fixture page') ? 'design card pressed' : '';",
		'design card pressed'
	);
	const image = "const image = document.querySelector('.image-canvas img');";
	return page.until(`${image} return image?.naturalWidth ? 'loaded' : '';`, 'loaded', 90);
}

export type { FixtureView, PairingOffer, Acceptance } from './ios-acceptance-run.types';

/** Waits for words on the page and records that they came; a timeout fails the check by name. */
export async function seen(run: Acceptance, expression: string, words: string, name: string) {
	try {
		const value = await run.page.until(expression, words, 120);
		run.record.check(true, name);
		return value;
	} catch (error) {
		run.record.check(false, name);
		throw error;
	}
}

/** Exercise each detail on the same native owner snapshot as the Mac app. */
export async function overviewDetails(run: Acceptance) {
	const { page } = run;
	await page.evaluate("press('Review decision');");
	await seen(
		run,
		"return text('dialog');",
		'Synthetic question for the owner?',
		'the decision opens the current owner question'
	);
	await overviewShot(run, 'project-overview-decision');
	await page.evaluate("press('Close');");
	await page.evaluate("document.querySelector('.po-item-open')?.click();");
	await seen(
		run,
		"return text('dialog');",
		'Open run #101',
		'the item offers its current live run'
	);
	await page.evaluate("press('Open run #101');");
	await seen(
		run,
		"return text('dialog');",
		'fixture-computer',
		'the run opens its computer and status'
	);
	await overviewShot(run, 'project-overview-run');
	await page.evaluate("press('Close');");
}

export async function overviewShot(run: Acceptance, name: string): Promise<void> {
	await run.page.until(
		"return String(document.fonts.status === 'loaded' && [...document.querySelectorAll('main img')].every(image => image.complete && image.naturalWidth > 0));",
		'true'
	);
	await shot(run, name);
}
