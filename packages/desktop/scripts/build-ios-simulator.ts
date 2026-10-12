import { iosBuildPlan, simulatorSigning } from './ios-build-options';
import type { IosBuildPlan } from './ios-build-options';
import {
	allowsLocalNetworking,
	builtProduct,
	changedCopy,
	derivedData,
	fixtureProduct,
	inspectable,
	tool,
	verifiedSignature
} from './ios-products';

/**
 * Builds the iOS app for a simulator: Debug by default, `--release` for the Release
 * configuration, `--sync` to build the renderer and copy it into the native project first.
 * Every product is signed ad hoc and names no team, no account and no provisioning, so that the
 * simulator's Keychain works; a normal product has no networking exception and is not
 * inspectable. All of that is read back from the product after the build, and the build fails
 * when it is not so.
 *
 * `--fixture` is TEST ONLY and Debug only; with `--release` it is refused before anything is
 * built. It leaves the Debug product as built and makes a copy beside it that may reach the
 * local test relay and be read by a check, signed again ad hoc.
 */
function build(plan: IosBuildPlan): void {
	const product = builtProduct(plan.configuration);
	if (plan.sync) tool(['bun', 'run', 'cap:sync']);
	tool([
		'xcodebuild',
		'-project',
		'ios/App/App.xcodeproj',
		'-scheme',
		'App',
		'-configuration',
		plan.configuration,
		'-sdk',
		'iphonesimulator',
		'-destination',
		'generic/platform=iOS Simulator',
		'-derivedDataPath',
		derivedData,
		'-quiet',
		...simulatorSigning,
		'build'
	]);
	if (allowsLocalNetworking(product) || inspectable(product))
		throw new Error('A normal product must have no networking exception and no web inspection.');
	console.log(`${plan.configuration} simulator build; signature ${verifiedSignature(product)}.`);
	console.log(product);
	if (!plan.fixture) return;
	const signature = changedCopy(product, fixtureProduct, {
		localNetworking: true,
		inspection: true
	});
	console.log(`TEST ONLY fixture copy of it; signature ${signature}.`);
	console.log(fixtureProduct);
}

const plan = iosBuildPlan(process.argv.slice(2));
if ('error' in plan) {
	console.error(plan.error);
	process.exit(2);
}
try {
	build(plan);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}
