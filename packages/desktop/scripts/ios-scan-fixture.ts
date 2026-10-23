import { cpSync, readFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { scanMarker } from './ios-acceptance-guards';
import { simulatorSigning } from './ios-build-options';
import { followed } from './ios-build-processes';
import {
	changedCopy,
	contents,
	derivedData,
	desktopRoot,
	fileDigest,
	succeeded
} from './ios-products';

/**
 * TEST ONLY. The one product that can be handed a QR code without a camera. It is built from an
 * isolated copy of the native source in which the camera scanner is replaced by the synthetic
 * one of ios/Checks/Acceptance, and nothing else differs. The real source is only read, and no
 * product built from it holds that scanner or understands its launch argument.
 */
const root = resolve(desktopRoot, '.cache/ios/scan-fixture');
export const scanFixtureProduct = resolve(root, 'App.app');
const camera = 'App/App/Scanner/RemoteCameraScanner.swift';
const synthetic = 'Checks/Acceptance/SyntheticScanner.swift';

/** Whether any file of a product holds these words. */
export function holds(product: string, words: string): boolean {
	return contents(product).some((file) => readFileSync(file).includes(words));
}

/** The copy of the native source with its scanner exchanged; every other file is unchanged. */
function isolatedSource(): string {
	const real = resolve(desktopRoot, 'ios'),
		copy = resolve(root, 'ios');
	rmSync(root, { recursive: true, force: true });
	cpSync(real, copy, { recursive: true });
	cpSync(resolve(real, synthetic), resolve(copy, camera));
	const differing = contents(real)
		.map((file) => relative(real, file))
		.filter((file) => fileDigest(resolve(real, file)) !== fileDigest(resolve(copy, file)));
	if (differing.join() === camera) return resolve(copy, 'App/App.xcodeproj');
	throw new Error(`The isolated copy differs in more than its scanner: ${differing.join(', ')}`);
}

/**
 * Builds the copy as a Debug simulator product beside everything else, with the packages the
 * normal build already fetched, and makes it readable for a check like the fixture copy.
 */
export async function buildScanFixture(): Promise<string> {
	const data = resolve(root, 'DerivedData'),
		packages = resolve(derivedData, 'SourcePackages');
	const project = ['-project', isolatedSource(), '-scheme', 'App', '-configuration', 'Debug'],
		place = ['-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator'],
		kept = ['-derivedDataPath', data, '-clonedSourcePackagesDirPath', packages];
	const built = await followed([
		'xcodebuild',
		'-jobs',
		process.env.CARGO_BUILD_JOBS ?? '1',
		...project,
		...place,
		...kept,
		'-quiet',
		...simulatorSigning,
		'build'
	]);
	if (built.left) console.error(built.left);
	succeeded('xcodebuild', built);
	const product = resolve(data, 'Build/Products/Debug-iphonesimulator/App.app');
	if (!holds(product, scanMarker))
		throw new Error('The scan fixture product does not hold the synthetic scanner.');
	return changedCopy(product, scanFixtureProduct, { localNetworking: true, inspection: true });
}
