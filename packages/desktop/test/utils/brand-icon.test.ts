import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { brandIcon } from '../../src/utils/brandIcon';
import { macIcon } from '../../scripts/mac-icon';

/**
 * The native icons are rasterised from the shared modular H: crisp gold tiles on navy with a
 * margin. The iOS asset is exactly that picture, and the Mac app is given a named Harness icon.
 */
const ios = resolve(
	import.meta.dirname,
	'../../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
);
function decode(png: Uint8Array) {
	const view = Buffer.from(png);
	const [width, height, depth, kind] = [
		view.readUInt32BE(16),
		view.readUInt32BE(20),
		view[24],
		view[25]
	];
	const data: Buffer[] = [];
	for (let at = 8; at < view.length; ) {
		const length = view.readUInt32BE(at);
		if (view.toString('ascii', at + 4, at + 8) === 'IDAT')
			data.push(view.subarray(at + 8, at + 8 + length));
		at += length + 12;
	}
	const channels = kind === 6 ? 4 : 3;
	const raw = inflateSync(Buffer.concat(data));
	const pixel = (x: number, y: number) => {
		const row = y * (width * channels + 1);
		expect(raw[row]).toBe(0);
		const start = row + 1 + x * channels;
		return [...raw.subarray(start, start + channels)];
	};
	return { width, height, depth, kind, pixel };
}

test('the iOS icon is 1024 square, opaque, gold tiles in a modular H on navy', async () => {
	const icon = decode(await readFile(ios));
	expect([icon.width, icon.height, icon.depth, icon.kind]).toEqual([1024, 1024, 8, 2]);
	const navy = [11, 26, 55];
	const gold = [242, 191, 63];
	expect(icon.pixel(4, 4)).toEqual(navy);
	expect(icon.pixel(512, 512)).toEqual(gold);
	expect(icon.pixel(512, 300)).toEqual(navy);
	for (const [x, y] of [
		[300, 300],
		[724, 300],
		[300, 724],
		[724, 724]
	])
		expect(icon.pixel(x, y)).toEqual(gold);
	expect(Buffer.from(await readFile(ios)).equals(Buffer.from(brandIcon(1024, 'ios')))).toBe(true);
});

test('the Mac icon keeps a transparent margin around its navy plate', () => {
	const icon = decode(brandIcon(512, 'mac'));
	expect([icon.width, icon.height, icon.kind]).toEqual([512, 512, 6]);
	expect(icon.pixel(2, 2)[3]).toBe(0);
	expect(icon.pixel(256, 256)).toEqual([242, 191, 63, 255]);
});

test.runIf(process.platform === 'darwin')(
	'a packaged Mac app is given the named Harness icon',
	async () => {
		const app = await mkdtemp(join(tmpdir(), 'harness-icon-'));
		try {
			await mkdir(join(app, 'Contents/Resources'), { recursive: true });
			const plist =
				'<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIconFile</key><string>electron.icns</string></dict></plist>';
			await writeFile(join(app, 'Contents/Info.plist'), plist);
			await macIcon(app);
			const read = (key: string) =>
				execFileSync(
					'/usr/libexec/PlistBuddy',
					['-c', `Print :${key}`, join(app, 'Contents/Info.plist')],
					{ encoding: 'utf8' }
				).trim();
			expect(read('CFBundleIconFile')).toBe('Harness.icns');
			const size = execFileSync(
				'sips',
				['-g', 'pixelWidth', join(app, 'Contents/Resources/Harness.icns')],
				{ encoding: 'utf8' }
			);
			expect(size).toMatch(/pixelWidth: 1024/);
		} finally {
			await rm(app, { recursive: true, force: true });
		}
	},
	60_000
);
