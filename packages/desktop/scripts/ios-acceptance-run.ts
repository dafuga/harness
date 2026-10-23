import type { FixtureView, Acceptance, PairingOffer } from './ios-acceptance-run.types';
import { resolve } from 'node:path';
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
		throw new Error('The control of the fixture is not on this machine.');
	const sent = body && {
		body: JSON.stringify(body),
		headers: { 'content-type': 'application/json' }
	};
	const method = path === '/status' ? 'GET' : 'POST';
	const response = await fetch(run.controlOrigin + path, { method, ...sent });
	if (!response.ok) throw new Error(`The fixture refused ${path} (${response.status}).`);
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
	await page.until(`return press(${open}) ? 'pressed' : '';`, 'pressed');
	await page.until('return document.title;', project.name);
	await page.until("return pressLink('Review designs') ? 'pressed' : '';", 'pressed');
	const image = "const image = document.querySelector('.image-canvas img');";
	return page.until(`${image} return image?.naturalWidth ? 'loaded' : '';`, 'loaded', 90);
}

export type { FixtureView, PairingOffer, Acceptance } from './ios-acceptance-run.types';
