// @harness-uid u_3en7p2purk
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { App } from 'electron';

/** The packaged Mac app uses a new Safe Storage name and keeps the previous profile. */
export function preserveMacProfile(app: App): void {
	if (process.platform !== 'darwin' || !app.isPackaged) return;
	if (app.commandLine.hasSwitch('user-data-dir')) return;
	const directory = resolve(app.getPath('appData'), 'harness-desktop');
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	app.setPath('userData', directory);
}

/** The migration stays inside Keychain Services. The process exposes only an exit status. */
export function migrateMacSafeStorage(app: App): boolean {
	if (process.platform !== 'darwin' || !app.isPackaged) return true;
	const directory = app.getPath('userData');
	const needsLegacyKey = ['session.enc', 'remote.enc'].some((file) =>
		Boolean(lstatSync(resolve(directory, file), { throwIfNoEntry: false }))
	);
	if (!needsLegacyKey) return true;
	const helper = resolve(process.resourcesPath, '../Helpers/HarnessKeychainMigration');
	const args = app.commandLine.hasSwitch('harness-migrate-safe-storage') ? ['--interactive'] : [];
	return spawnSync(helper, args, { stdio: 'ignore' }).status === 0;
}
