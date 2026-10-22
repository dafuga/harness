import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { localOrigin, loopbackArgument, scanArgument } from './ios-acceptance-guards';
import type { SimulatorPage } from './ios-acceptance-page';
import type { AcceptanceRecord } from './ios-acceptance-record';
import { launch, screenshot } from './ios-acceptance-simulator';

/** What the control of the TEST ONLY fixture answers about its computer. */
export interface FixtureView {
	state: string;
	locked: boolean | null;
	requests: { deviceId: string; deviceName: string }[];
	devices: { deviceId: string; name: string; online: boolean }[];
}
/** A one-time offer. Its code and its QR text are hidden by the record as soon as it arrives. */
export interface PairingOffer {
	pairingId: string;
	code: string;
	/** The text of the QR code: what a camera would read from the computer. */
	scan: string;
}

/** TEST ONLY. Everything one phase of the native acceptance run works with. */
export interface Acceptance {
	record: AcceptanceRecord;
	page: SimulatorPage;
	udid: string;
	/** The control of the run's own fixture; always on this machine. */
	controlOrigin: string;
	project: { id: string; name: string };
	/** Where screenshots and the report go; ignored by Git. */
	output: string;
}

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
export async function openDesign(run: Acceptance, title: string = 'Fixture page'): Promise<string> {
	const { page, project } = run;
	const open = JSON.stringify(`Open ${project.name}`);
	try {
		await page.until(`return press(${open}) ? 'pressed' : '';`, 'pressed');
	} catch (error) {
		await shot(run, 'project-opener-failed');
		const state = await page
			.evaluate(
				`return JSON.stringify({
			path: location.pathname, title: document.title,
			openerLabels: [...document.querySelectorAll('button[aria-label^="Open "]')]
				.map((item) => item.getAttribute('aria-label'))
		});`
			)
			.catch(() => 'The stopped page could not be inspected.');
		const reason = error instanceof Error ? error.message : String(error);
		await writeFile(resolve(run.output, 'project-opener-failed.json'), run.record.safe(state));
		throw new Error(run.record.safe(`${reason}; project opener state: ${state}`));
	}
	await page.until('return document.title;', project.name);
	const design = JSON.stringify(`Open ${title}`);
	await page.until(`return press(${design}) ? 'pressed' : '';`, 'pressed');
	const image = "const image = document.querySelector('.image-canvas img');";
	return page.until(`${image} return image?.naturalWidth ? 'loaded' : '';`, 'loaded', 90);
}
