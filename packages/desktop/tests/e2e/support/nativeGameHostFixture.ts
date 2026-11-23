import type { ElectronApplication } from '../../../../../test/support/browserTest';
import { appendFileSync, mkdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const desktop = resolve(import.meta.dirname, '../../..');

export function watchGameHost(app: ElectronApplication, profile: string) {
	const directory = join(desktop, '.cache/game-native-host');
	mkdirSync(directory, { recursive: true });
	const path = join(directory, basename(profile) + '.ndjson');
	const log = (event: string, data: unknown) =>
		appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), event, data }) + '\n');
	log('launched', { pid: app.process().pid, profile });
	app.process().stderr?.on('data', (chunk) => log('stderr', String(chunk)));
	app.process().stdout?.on('data', (chunk) => log('stdout', String(chunk)));
	app.process().on('exit', (code, signal) => log('exit', { code, signal }));
	app.context().on('close', () => log('context-close', null));
	for (const page of app.context().pages()) {
		page.on('crash', () => log('renderer-crash', page.url()));
		page.on('close', () => log('page-close', page.url()));
	}
}
