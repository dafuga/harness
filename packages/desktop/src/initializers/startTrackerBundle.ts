// @harness-uid u_x346uctfa2
import { app } from 'electron';
import { homedir } from 'node:os';
import { startBundledTracker } from '../services/development-tooling/tracker-bundle/startBundledTracker';

/**
 * Installs or updates the Tracker that ships in the packaged Mac app, in the background after
 * Electron is ready. A failure is logged and never stops the app.
 */
function startTrackerBundle(): void {
	if (!app.isPackaged || process.platform !== 'darwin') return;
	void app
		.whenReady()
		.then(() => startBundledTracker(app.getAppPath(), homedir()))
		.then(
			(outcome) => console.info(`Harness Tracker bundle: ${JSON.stringify(outcome)}`),
			(error: unknown) => console.error('Harness Tracker bundle failed', error)
		);
}

startTrackerBundle();
