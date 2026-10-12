import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { simulatorSigning } from '../scripts/ios-build-options';
import { verifiedSignature } from '../scripts/ios-products';

/**
 * Xcode links "simulated" entitlements into the executable of a simulator product. With an
 * account signed in to Xcode it puts a team of that account in front of the app's identifier,
 * also when the build names no team and the signature itself says "TeamIdentifier=not set".
 * These tests make such executables with the real linker and the real codesign; the team here
 * is made up.
 */
const mac = process.platform === 'darwin';
const app = 'com.dafuga.harness';
const root = mkdtempSync(join(tmpdir(), 'harness-ios-entitlements-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const plist = (body: string) =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n${body}</dict>\n</plist>\n`;
const entitled = (identifier: string) =>
	plist(`\t<key>application-identifier</key>\n\t<string>${identifier}</string>\n`);
const described = plist(
	`\t<key>CFBundleIdentifier</key>\n\t<string>${app}</string>\n` +
		'\t<key>CFBundleExecutable</key>\n\t<string>App</string>\n' +
		'\t<key>CFBundlePackageType</key>\n\t<string>APPL</string>\n'
);

/** A signed bundle whose executable carries the given simulated entitlements, or none. */
function product(name: string, entitlements: string | null): string {
	const folder = join(root, name);
	const bundle = join(folder, 'App.app');
	mkdirSync(bundle, { recursive: true });
	writeFileSync(join(folder, 'main.c'), 'int main(void) { return 0; }\n');
	writeFileSync(join(folder, 'simulated.xcent'), entitlements ?? '');
	writeFileSync(join(bundle, 'Info.plist'), described);
	const section = `-Wl,-sectcreate,__TEXT,__entitlements,${join(folder, 'simulated.xcent')}`;
	const link = ['clang', join(folder, 'main.c'), '-o', join(bundle, 'App')];
	execFileSync('xcrun', entitlements ? [...link, section] : link, { stdio: 'pipe' });
	execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', bundle], {
		stdio: 'pipe'
	});
	return bundle;
}

test.skipIf(!mac)('a product whose entitlements name the app alone is verified', () => {
	expect(verifiedSignature(product('alone', entitled(app)))).toContain('ad hoc');
});

test.skipIf(!mac)('a product whose entitlements carry a team of an account is rejected', () => {
	const borrowed = product('team', entitled(`ABCDE12345.${app}`));
	expect(() => verifiedSignature(borrowed)).toThrow(/team/i);
});

test.skipIf(!mac)('a product that declares a team identifier is rejected', () => {
	const declared = plist(
		`\t<key>application-identifier</key>\n\t<string>${app}</string>\n` +
			'\t<key>com.apple.developer.team-identifier</key>\n\t<string>ABCDE12345</string>\n'
	);
	expect(() => verifiedSignature(product('declared', declared))).toThrow(/team/i);
});

test.skipIf(!mac)('a product without simulated entitlements is rejected', () => {
	// Such a product starts, but the simulator's Keychain refuses to keep a pairing (-34018).
	expect(() => verifiedSignature(product('none', null))).toThrow(/entitlements/i);
});

test('the build names its own entitlements and lets Xcode add none from an account', () => {
	expect(simulatorSigning).toContain('CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO');
	const named = simulatorSigning.find((item) => item.startsWith('CODE_SIGN_ENTITLEMENTS='));
	const own = readFileSync(String(named).slice('CODE_SIGN_ENTITLEMENTS='.length), 'utf8');
	expect(own).toContain(`<string>${app}</string>`);
	expect(own).not.toMatch(/team|\$\(/i);
});
