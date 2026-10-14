import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brandIcon } from '../src/utils/brandIcon';

/** The sizes of a macOS iconset; each is also written at twice its size. */
const sizes = [16, 32, 128, 256, 512];

/**
 * Gives a packaged Mac app the Harness icon: an iconset rasterised from the shared mark, made
 * into Harness.icns by iconutil and named as the bundle icon in its Info.plist.
 */
export async function macIcon(app: string): Promise<void> {
	const folder = await mkdtemp(join(tmpdir(), 'harness-iconset-'));
	const iconset = join(folder, 'Harness.iconset');
	try {
		await mkdir(iconset);
		for (const size of sizes) {
			await writeFile(join(iconset, `icon_${size}x${size}.png`), brandIcon(size, 'mac'));
			await writeFile(join(iconset, `icon_${size}x${size}@2x.png`), brandIcon(size * 2, 'mac'));
		}
		const icon = join(app, 'Contents/Resources/Harness.icns');
		execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icon]);
		const plist = join(app, 'Contents/Info.plist');
		execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Set :CFBundleIconFile Harness.icns', plist]);
	} finally {
		await rm(folder, { recursive: true, force: true });
	}
}
