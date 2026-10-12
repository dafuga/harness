import { scrolledLayout, topLayout } from './ios-acceptance-layout';
import {
	computerName,
	control,
	footerText,
	openDesign,
	panelText,
	restart,
	shot
} from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';
import { keychainGroups } from './ios-acceptance-simulator';

const listed = (selector: string) =>
	`[...document.querySelectorAll('${selector}')].map((item) => item.textContent.trim()).join(',')`;

/** Whether commenting on the design is offered: only a current, writable view offers it. */
const commenting = `
const comment = [...document.querySelectorAll('main.entity-main button')].find((item) => item.textContent.trim() === 'Comment on image');
return !comment ? 'absent' : comment.disabled ? 'disabled' : 'offered';`;
/** The status bar once it is neither a saved view nor still loading one. */
const settled = `
const bar = footer();
const stale = ['Offline cached view', 'Read-only', 'Loading project'].some((words) => bar.includes(words));
return (stale ? 'stale: ' : 'current: ') + bar;`;

/** Waits for words on the page and records that they came; a timeout fails the check by name. */
async function seen(run: Acceptance, expression: string, words: string, name: string) {
	try {
		const value = await run.page.until(expression, words, 120);
		run.record.check(true, name);
		return value;
	} catch (error) {
		run.record.check(false, name);
		throw error;
	}
}

/** TEST ONLY. The shared workspace through the real plugin, and the lock state of the computer. */
export async function workspace(run: Acceptance): Promise<void> {
	const { record, page, project } = run;
	record.begin('Workspace through the encrypted channel');
	await restart(run);
	const connected = `Connected to ${computerName}`;
	await seen(run, panelText, connected, 'started again, the app finds its pairing and connects');
	record.check(
		(await openDesign(run)) === 'loaded',
		'the project opens and its design image arrives through the encrypted channel'
	);
	const folder = `document.querySelector('[aria-label="Add local project"]') ? 'folder' : 'none'`;
	const surface = await page.evaluate(`return [location.pathname, ${folder}].join(' | ');`);
	record.check(
		surface.includes(project.id) && surface.includes('/harness/branch/main/pages/'),
		'the workspace is the shared one, at the address of project, branch and entity'
	);
	record.check(surface.endsWith('none'), 'a phone is offered no local folder');
	const offered = 'commenting on the design is offered while the computer is connected';
	await seen(run, commenting, 'offered', offered);
	await topLayout(run);
	await page.evaluate("press('Conversation'); return 'ok';");
	const modes = await page.until(`return ${listed('.mode-options button')};`, 'Comment');
	record.check(modes === 'Comment,Plan,Change', 'a grant with agents offers Comment, Plan, Change');
	await page.evaluate("press('Plan'); return 'ok';");
	const models = `return 'models ' + ${listed('select[aria-label="Model"] option')};`;
	await seen(run, models, 'ixture', 'the models are those the fixture computer listed');
	await page.evaluate("press('Close conversation'); return 'ok';");
	await control(run, '/lock');
	await seen(run, footerText, 'Computer locked · awake', 'a locked computer is shown as locked');
	await control(run, '/unlock');
	await seen(run, footerText, 'Computer unlocked · awake', 'and as unlocked when it is again');
}

/** TEST ONLY. What the phone kept, read while the computer is away and after the app closed. */
export async function savedCopies(run: Acceptance): Promise<void> {
	const { record, page } = run;
	record.begin('Saved copies while the computer is away');
	await control(run, '/suspend');
	const away = await seen(run, footerText, 'Offline cached view', 'the view becomes a cached one');
	record.check(away.includes('Computer offline'), 'the status bar says the computer is offline');
	await restart(run);
	const kept = 'closed and started again meanwhile, the app is still paired: offline, not unpaired';
	await seen(run, panelText, 'Computer offline', kept);
	record.check(
		(await openDesign(run)) === 'loaded',
		'the project and its image come from the saved copies of the phone'
	);
	const saved = await seen(run, footerText, 'Read-only · saved', 'the saved view is dated');
	record.check(
		saved.includes('Offline cached view') && saved.includes('not checked with the server'),
		'it says that it is read-only, cached and not checked with the server'
	);
	record.check(
		(await page.evaluate(commenting)) === 'disabled',
		'commenting is disabled in the saved view'
	);
	await scrolledLayout(run);
}

/** TEST ONLY. The computer comes back; then it removes the phone. */
export async function reconnection(run: Acceptance): Promise<void> {
	const { record, project } = run;
	record.begin('Reconnect and revocation');
	await control(run, '/resume');
	const back = 'when the computer is back the phone reconnects by itself';
	await seen(run, panelText, `Connected to ${computerName}`, back);
	const current = 'and the view is current again: not cached, not read-only, not loading';
	await seen(run, settled, 'current: ', current);
	await seen(run, commenting, 'offered', 'and commenting on the design is offered again');
	const { devices } = await control(run, '/status');
	record.check(devices.length === 1 && devices[0].online, 'the computer lists the phone online');
	await shot(run, 'reconnected');
	await control(run, '/revoke', {});
	const body = 'return document.body.innerText;';
	const gone = await seen(run, body, 'access was removed', 'removal is shown on the phone');
	record.check(!gone.includes(project.name), 'and takes the workspace and every project name');
	await shot(run, 'revoked');
	await restart(run);
	const form = await seen(run, panelText, 'Connect to computer', 'started again, it is unpaired');
	record.check(form.includes('Pairing link'), 'and offers the pairing form');
	record.check(
		keychainGroups(run.udid).length === 0,
		'nothing of the app is left in the Keychain of the simulator'
	);
}
