import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * What a built simulator product is, and the two TEST ONLY changes a copy of one may get. A
 * product that xcodebuild made is never changed in place: a changed product is a copy beside
 * it, signed again ad hoc, and named for what it is.
 */
export const desktopRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const derivedData = resolve(desktopRoot, '.cache/ios/DerivedData');
export const fixtureProduct = resolve(desktopRoot, '.cache/ios/fixture/App.app');

export function builtProduct(configuration: 'Debug' | 'Release'): string {
	return resolve(derivedData, `Build/Products/${configuration}-iphonesimulator/App.app`);
}

/** Runs a tool to its end: its exit code and everything it wrote. */
export function tried(command: string[]): { code: number; output: string } {
	const options = { cwd: desktopRoot, encoding: 'utf8' as const, maxBuffer: 1 << 28 };
	const result = spawnSync(command[0], command.slice(1), options);
	return { code: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** The output of a tool that must succeed; a failure is an error with the tool's last words. */
export function tool(command: string[]): string {
	const { code, output } = tried(command);
	if (code === 0) return output;
	const last = output.trim().split('\n').slice(-25).join('\n');
	throw new Error(`${command[0]} failed (${code}):\n${last}`);
}

export function fileDigest(file: string): string {
	return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** The entitlements the simulator reads live in the executable; signing must leave them alone. */
function simulated(product: string): string {
	const section = tool(['otool', '-s', '__TEXT', '__entitlements', resolve(product, 'App')]);
	return createHash('sha256').update(section).digest('hex');
}

/** Every regular file under a folder. */
export function contents(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(folder, entry.name);
		if (entry.isDirectory()) return contents(path);
		return entry.isFile() ? [path] : [];
	});
}

/**
 * The identity the simulator gives an app is read from entitlements linked into its executable.
 * Xcode puts a team of a signed-in account there by itself, also when the build names none and
 * the signature says "TeamIdentifier=not set". So the whole product is read: it must name the
 * app alone, and nothing in it may carry a team or a provisioning profile.
 */
function accountProblem(product: string): string | null {
	const info = resolve(product, 'Info.plist');
	const app = tool(['/usr/libexec/PlistBuddy', '-c', 'Print :CFBundleIdentifier', info]).trim();
	const named = /<key>application-identifier<\/key>\s*<string>([^<]*)<\/string>/g;
	const own = readFileSync(resolve(product, 'App')).toString('latin1');
	const identifiers = [...own.matchAll(named)].map((match) => match[1]);
	if (!identifiers.length)
		return 'The product has no simulated entitlements: the simulator Keychain refuses such an app.';
	const marks = [new RegExp(`[A-Z0-9]{10}\\.${app.replaceAll('.', '\\.')}`), /team-identifier/];
	const marked = contents(product).find((file) => {
		const text = readFileSync(file).toString('latin1');
		return file.endsWith('.mobileprovision') || marks.some((mark) => mark.test(text));
	});
	if (marked) return `A team of an account is named in ${relative(product, marked)}.`;
	if (identifiers.every((identifier) => identifier === app)) return null;
	return `The entitlements name ${identifiers.join(', ')}: a team, not the app alone.`;
}

/** Fails unless the product is validly signed ad hoc and names no team and no account. */
export function verifiedSignature(product: string): string {
	tool(['codesign', '--verify', '--strict', product]);
	const details = tool(['codesign', '-dv', product]);
	const adHoc = /flags=0x[0-9a-f]+\(.*adhoc.*\)/.test(details);
	if (!adHoc || !details.includes('TeamIdentifier=not set'))
		throw new Error('The product is not signed ad hoc without a team.');
	const problem = accountProblem(product);
	if (problem) throw new Error(problem);
	return 'ad hoc, no team, no account';
}

export function allowsLocalNetworking(product: string): boolean {
	const plist = resolve(product, 'Info.plist');
	const read = ['/usr/libexec/PlistBuddy', '-c', 'Print :NSAppTransportSecurity', plist];
	return tried(read).code === 0;
}

export function inspectable(product: string): boolean {
	const config = JSON.parse(readFileSync(resolve(product, 'capacitor.config.json'), 'utf8')) as {
		ios?: { webContentsDebuggingEnabled?: boolean };
	};
	return config.ios?.webContentsDebuggingEnabled === true;
}

/** What a report says of one product: where it is, what it is, and that it was verified. */
export function productFacts(product: string) {
	return {
		path: relative(desktopRoot, product),
		executable: fileDigest(resolve(product, 'App')),
		signature: verifiedSignature(product),
		localNetworking: allowsLocalNetworking(product),
		inspectable: inspectable(product)
	};
}

export interface ProductChange {
	/**
	 * Plain http to this machine is let through by the system. A Debug fixture copy needs it to
	 * reach the local test relay; a Release copy gets it to show that it still refuses by itself.
	 */
	localNetworking: boolean;
	/** WebKit's inspector may attach, so that a check can read the page. */
	inspection: boolean;
}

/**
 * TEST ONLY. A copy of a built product with the named changes, signed again ad hoc with the
 * simulator entitlements it had. The product it was copied from is left exactly as built.
 */
export function changedCopy(source: string, target: string, change: ProductChange): string {
	rmSync(target, { recursive: true, force: true });
	cpSync(source, target, { recursive: true });
	const before = simulated(target);
	const plist = resolve(target, 'Info.plist');
	const set = (command: string) => tried(['/usr/libexec/PlistBuddy', '-c', command, plist]);
	if (change.localNetworking) {
		set('Add :NSAppTransportSecurity dict');
		set('Add :NSAppTransportSecurity:NSAllowsLocalNetworking bool true');
	}
	if (change.inspection) {
		const bundled = resolve(target, 'capacitor.config.json');
		const config = JSON.parse(readFileSync(bundled, 'utf8')) as { ios?: object };
		config.ios = { ...config.ios, webContentsDebuggingEnabled: true };
		writeFileSync(bundled, JSON.stringify(config, null, '\t'));
	}
	const sign = ['codesign', '--force', '--sign', '-', '--timestamp=none'];
	tool([...sign, '--preserve-metadata=entitlements,flags', target]);
	if (simulated(target) === before) return verifiedSignature(target);
	throw new Error('Signing again changed the simulator entitlements of the product.');
}
