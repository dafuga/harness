import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

/**
 * The app has one way to be handed a pairing code: its camera. This reads the native source of
 * the product as it is built and holds it to that; the synthetic scanner of an acceptance run
 * exists only outside the app target. It is a guard of the source, not proof of a build.
 */
const ios = resolve(import.meta.dirname, '../ios');
const app = join(ios, 'App/App');
const read = (path: string) => readFileSync(path, 'utf8');
const project = read(join(ios, 'App/App.xcodeproj/project.pbxproj'));
function swiftFiles(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const path = join(folder, entry.name);
		if (entry.isDirectory()) return swiftFiles(path);
		return entry.name.endsWith('.swift') ? [path] : [];
	});
}
const product = swiftFiles(app);
const named = (text: string) => product.filter((file) => read(file).includes(text));
const short = (files: string[]) => files.map((file) => file.slice(app.length + 1)).sort();

test('the standard app contains its native sources and opts into no test fixtures', () => {
	for (const file of product) {
		const name = file.split('/').pop() ?? '';
		expect([name, project.includes(`/* ${name} in Sources */`)]).toEqual([name, true]);
	}
	expect(short(product)).toContain('Scanner/RemoteCameraScanner.swift');
	expect(project).not.toContain('SyntheticScanner');
	expect(project).not.toContain('Checks/');
	expect(named('HarnessSyntheticScan')).toEqual([]);
	expect(read(join(ios, 'Checks/Acceptance/SyntheticScanner.swift'))).toContain('TEST ONLY');
	expect(project.match(/PRODUCT_BUNDLE_IDENTIFIER = com\.dafuga\.harness;/g)).toHaveLength(2);
	expect(project).not.toMatch(/vaultfixture|HARNESS_VAULT_FIXTURE/);
	expect(short(named('#if DEBUG && HARNESS_VAULT_FIXTURE'))).toEqual([
		'Vault/VaultInboxController.swift',
		'Vault/VaultLegacyFixture.swift',
		'Vault/VaultLegacyFixtureReview.swift'
	]);
	expect(read(join(app, 'Vault/VaultLegacyFixtureReview.swift'))).toContain(
		'guard Bundle.main.bundleIdentifier == "com.dafuga.harness.vaultfixture" else { return }'
	);
});

test('only the camera hands a scanned text to pairing, and only one scanner exists', () => {
	const conforms = /(class|struct|enum|extension) \w+:[^{\n]*\bRemoteScanner\b/;
	const scanners = product.filter((file) => conforms.test(read(file)));
	expect(short(scanners)).toEqual(['Scanner/RemoteCameraScanner.swift']);
	const scanResult = /(?<!case )(?<!\w)(?:RemoteScanOutcome)?\.text\(/;
	const made = product.filter((file) => scanResult.test(read(file)));
	expect(short(made)).toEqual(['Scanner/RemoteScannerViewController.swift']);
	const controller = read(join(app, 'Scanner/RemoteScannerViewController.swift'));
	expect(controller.match(/\.text\(/g)).toHaveLength(1);
	expect(controller).toContain('AVCaptureMetadataOutputObjectsDelegate');
	for (const file of [
		'Scanner/RemoteCameraScanner.swift',
		'Scanner/RemoteScannerViewController.swift'
	])
		expect(read(join(app, file))).not.toMatch(/#if|UserDefaults|ProcessInfo|arguments/);
});

test('the plugin offers a scan and no way to be handed an address, a code or a link', () => {
	const plugin = read(join(app, 'Remote/HarnessRemotePlugin.swift'));
	const methods = [...plugin.matchAll(/CAPPluginMethod\(name: "(\w+)"/g)].map((found) => found[1]);
	expect(methods).toEqual([
		'status',
		'scan',
		'disconnect',
		'request',
		'openVault',
		'trackerTool',
		'refreshTracker'
	]);
	const inbox = plugin.slice(
		plugin.indexOf('@objc func openVault'),
		plugin.indexOf('@objc func status')
	);
	expect(inbox).toContain('VaultInboxController(session: self.session)');
	expect(inbox).not.toMatch(/call\.(get\w+|options)/);
	expect(inbox.match(/call\.resolve\([^)]*\)/g)).toEqual(['call.resolve()']);
	expect(plugin).not.toMatch(
		/#if|capacitorOpenURL|pairingLink|getString\("(origin|code|hostId|pairingId)"\)/
	);
	expect(plugin.match(/RemoteCameraScanner\(/g)).toHaveLength(1);
	const debug = read(join(app, 'Remote/RemotePolicy.swift'));
	const hooks = debug.slice(debug.indexOf('enum RemoteDebug'), debug.indexOf('#endif'));
	expect(hooks.match(/static var \w+/g)).toEqual(['static var loopback']);
	expect(named('HarnessRemoteOpenURL')).toEqual([]);
});

test('the app asks for the camera in words of its own and only registers its system sign-in callback', () => {
	const plist = read(join(app, 'Info.plist'));
	expect(plist).toMatch(/<key>NSCameraUsageDescription<\/key>\s*<string>[^<]{20,}<\/string>/);
	const schemes = plist.match(/<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/);
	expect(schemes?.[1].match(/<string>[^<]+<\/string>/g)).toEqual([
		'<string>harness-account</string>'
	]);
	const delegate = read(join(app, 'AppDelegate.swift'));
	expect(delegate).toMatch(/if url\.scheme == HubAccountSession\.googleScheme \{ return false \}/);
	expect(plist).not.toContain('harnessremote');
});
