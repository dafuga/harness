import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { brandMark } from '../../reports/src/utils/brandMark';
import { brandIcon } from '../src/utils/brandIcon';

/**
 * Writes the brand assets from the shared geometry: the favicon of each app and the 1024 pixel
 * iOS app icon. Run it again after the geometry changes; the tests compare against it.
 */
const packages = resolve(import.meta.dirname, '../..');
for (const app of ['desktop', 'hub', 'reports']) {
	await mkdir(resolve(packages, app, 'static'), { recursive: true });
	await writeFile(resolve(packages, app, 'static/favicon.svg'), brandMark() + '\n');
}
const ios = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png';
await writeFile(resolve(import.meta.dirname, '..', ios), brandIcon(1024, 'ios'));
