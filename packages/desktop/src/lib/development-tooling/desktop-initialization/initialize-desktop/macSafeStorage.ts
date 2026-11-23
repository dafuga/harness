// @harness-uid u_3en7p2purk
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { dialog } from 'electron';
import type { App } from 'electron';

function migrationHelper(): string | undefined {
	const resources = process.resourcesPath;
	return resources ? resolve(resources, '../Helpers/HarnessKeychainMigration') : undefined;
}

/** Bundles made from Electron's stock executable may report isPackaged=false. */
function macRelease(app: App): boolean {
	if (process.platform !== 'darwin') return false;
	const helper = migrationHelper();
	return app.isPackaged || Boolean(helper && existsSync(helper));
}

/** The packaged Mac app uses a new Safe Storage name and keeps the previous profile. */
export function preserveMacProfile(app: App): void {
	if (!macRelease(app)) return;
	const directory = resolve(app.getPath('appData'), 'harness-desktop');
	if (app.commandLine.hasSwitch('user-data-dir')) {
		const profile = resolve(app.commandLine.getSwitchValue('user-data-dir'));
		if (profile !== directory) {
			const suffix = createHash('sha256').update(profile).digest('hex').slice(0, 16);
			app.setName(`Harness ${suffix}`);
		}
		return;
	}
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	app.setPath('userData', directory);
}

/** The migration stays inside Keychain Services. The process exposes only an exit status. */
function migrateMacSafeStorage(app: App): boolean {
	if (!macRelease(app)) return true;
	const directory = app.getPath('userData');
	const needsLegacyKey = ['session.enc', 'remote.enc'].some((file) =>
		Boolean(lstatSync(resolve(directory, file), { throwIfNoEntry: false }))
	);
	if (!needsLegacyKey) return true;
	const helper = migrationHelper();
	if (!helper) return false;
	const args = [app.getName()];
	if (app.commandLine.hasSwitch('harness-migrate-safe-storage')) args.push('--interactive');
	return spawnSync(helper, args, { stdio: 'ignore' }).status === 0;
}

/** Starts after Electron is ready and quits safely when legacy data cannot be opened. */
export async function prepareDesktopStorage(app: App): Promise<boolean> {
	await app.whenReady();
	if (migrateMacSafeStorage(app)) return true;
	dialog.showErrorBox(
		'Harness storage migration',
		'Existing encrypted data is preserved. See the Mac release instructions to migrate the previous Safe Storage key.'
	);
	app.quit();
	return false;
}
