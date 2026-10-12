import { resolve } from 'node:path';
import { localOrigin, loopbackArgument } from './ios-acceptance-guards';
import type { SimulatorPage } from './ios-acceptance-page';
import type { AcceptanceRecord } from './ios-acceptance-record';
import { launch, screenshot } from './ios-acceptance-simulator';

/** What the control of the TEST ONLY fixture answers about its computer. */
export interface FixtureView {
	state: string;
	locked: boolean | null;
	requests: unknown[];
	devices: { deviceId: string; name: string; online: boolean }[];
}
/** A one-time offer. Its code is handed to the record to be hidden as soon as it arrives. */
export interface PairingOffer {
	link: string;
	code: string;
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

/** A new one-time offer of the fixture; its code is hidden from everything the run writes. */
export async function offered(run: Acceptance): Promise<PairingOffer> {
	const offer = await control<PairingOffer>(run, '/pairing');
	run.record.hide(offer.code);
	return offer;
}

/** Starts the app again and forgets the page of the one that ran. */
export async function restart(run: Acceptance, fixture = true): Promise<void> {
	await run.page.reset();
	launch(run.udid, fixture ? [loopbackArgument] : []);
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
