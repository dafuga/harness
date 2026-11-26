/**
 * The main process the packaged-app test runs inside a real Harness.app. It imports the real
 * bundle initializer (the test's build replaces the install itself, so launchd is never
 * touched), loads a renderer in a window that is never shown, reports and exits.
 */
import { app, BrowserWindow } from 'electron';
import { writeFileSync } from 'node:fs';
import '../src/initializers/development-tooling/initializeTrackerBundle';

app.setActivationPolicy('accessory');
// The default profile would be the installed app's; this moves it without the launch switch.
app.setPath('userData', process.env.HARNESS_PROBE_PROFILE as string);

async function probe(report: string): Promise<void> {
	await app.whenReady();
	const window = new BrowserWindow({ show: false });
	await window.loadURL('data:text/html,<p>probe</p>');
	const rendered = await window.webContents.executeJavaScript('document.body.textContent');
	const started = (globalThis as { trackerStartedFrom?: string }).trackerStartedFrom ?? null;
	writeFileSync(
		report,
		JSON.stringify({ isPackaged: app.isPackaged, appPath: app.getAppPath(), started, rendered })
	);
	app.exit(0);
}

void probe(process.env.HARNESS_PROBE_REPORT as string).catch((error: unknown) => {
	console.error(error);
	app.exit(1);
});
