// @harness-uid u_fppws53qsn
import {
	type FixtureView,
	type Acceptance,
	FixtureControlOriginError,
	FixtureControlRefusedError
} from './ios-acceptance-run.types';
import { resolve } from 'node:path';
import { localOrigin, loopbackArgument } from './ios-acceptance-guards';
import { launch, screenshot } from './ios-acceptance-simulator';

export const computerName = 'Harness fixture computer';
export const panelText = 'return panel();';
export const footerText = 'return footer();';
export const pause = (milliseconds: number): Promise<void> =>
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

export type { FixtureView, Acceptance } from './ios-acceptance-run.types';
