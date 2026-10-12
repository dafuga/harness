import { rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AcceptanceRecord } from './ios-acceptance-record';
import { pause, shot } from './ios-acceptance-run';
import type { Acceptance } from './ios-acceptance-run';
import { install, launch, running } from './ios-acceptance-simulator';
import {
	missing,
	moved,
	nativeSources,
	rendererSources,
	sourceFiles,
	tree,
	treeDigest
} from './ios-acceptance-source';
import type { SourceReading } from './ios-acceptance-source';
import { fixtureNeedsDebug } from './ios-build-options';
import {
	builtProduct,
	changedCopy,
	desktopRoot,
	fixtureProduct,
	productFacts,
	tool,
	tried
} from './ios-products';

const build = ['bun', 'scripts/build-ios-simulator.ts'];
const releaseCopy = resolve(desktopRoot, '.cache/ios/acceptance/Release/App.app');
const assembled = (product: string) => statSync(resolve(product, 'App')).mtimeMs;

/**
 * The renderer in the products is the one this run built: what the build wrote is, file by
 * file, in the copy the native project holds, and every product carries exactly that copy.
 */
function rendererProof(record: AcceptanceRecord, products: string[]) {
	const built = tree(resolve(desktopRoot, 'build'));
	const copied = tree(resolve(desktopRoot, 'ios/App/App/public'));
	const carried = products.map((product) => treeDigest(tree(resolve(product, 'public'))));
	record.check(
		built.size > 0 && missing(built, copied).length === 0,
		`the renderer this run built is the one in the native project: ${built.size} files, unchanged`
	);
	record.check(
		carried.every((digest) => digest === treeDigest(copied)),
		'every product carries exactly that renderer'
	);
	return { built: treeDigest(built), copied: treeDigest(copied), files: copied.size };
}

/** A set of source files stayed as it was while something was built from it, or which did not. */
function steady(record: AcceptanceRecord, changed: string[], what: string) {
	const which = changed.length ? `; changed: ${changed.slice(0, 4).join(', ')}` : '';
	record.check(changed.length === 0, `the ${what} did not change while it was built${which}`);
}

/**
 * Builds with the normal commands, from the working tree as it is. The products of an earlier
 * build are removed first, so what is tested was put together by this run; each set of source
 * is read again right after what is built from it.
 */
function built(record: AcceptanceRecord, read: SourceReading) {
	const began = Date.now();
	const normal = [builtProduct('Debug'), builtProduct('Release')];
	for (const product of normal) rmSync(product, { recursive: true, force: true });
	tool(['bun', 'run', 'cap:sync']);
	steady(record, moved(read.renderer, sourceFiles(rendererSources)), 'source of the renderer');
	tool([...build, '--fixture']);
	tool([...build, '--release']);
	steady(record, moved(read.native, sourceFiles(nativeSources)), 'source of the native shell');
	changedCopy(builtProduct('Release'), releaseCopy, { localNetworking: true, inspection: true });
	record.check(
		normal.every((product) => assembled(product) >= began - 1000),
		'the Debug and Release products were put together by this run, not kept from an earlier one'
	);
	return normal;
}

/**
 * TEST ONLY. Builds what the run tests and reads every product back: the two normal products
 * as they are, and the two copies that a check may read.
 */
export function acceptanceProducts(record: AcceptanceRecord, read: SourceReading) {
	record.begin('Products');
	const refused = tried([...build, '--fixture', '--release']);
	record.check(
		refused.code === 2 && refused.output.includes(fixtureNeedsDebug),
		'a fixture build is refused for Release before anything is built'
	);
	const normal = built(record, read);
	const facts = {
		debug: productFacts(normal[0]),
		release: productFacts(normal[1]),
		fixtureCopy: productFacts(fixtureProduct),
		releaseCopy: productFacts(releaseCopy)
	};
	const plain = [facts.debug, facts.release].every(
		(product) => !product.localNetworking && !product.inspectable
	);
	record.check(plain, 'the normal Debug and Release products allow no local relay, no inspection');
	const signed = Object.values(facts).every((product) => product.signature.includes('no account'));
	record.check(signed, 'all four are signed ad hoc and name no team and no account anywhere');
	const renderer = rendererProof(record, [...normal, fixtureProduct, releaseCopy]);
	return { facts, renderer, releaseCopy };
}

/** The normal Debug product, exactly as built: it is installed, starts and keeps running. */
export async function normalProduct(run: Acceptance): Promise<void> {
	run.record.begin('Normal product');
	install(run.udid, builtProduct('Debug'));
	launch(run.udid);
	run.record.check(running(run.udid), 'the normal Debug product starts on the simulator');
	await pause(5000);
	run.record.check(running(run.udid), 'and is still running a moment later');
	await shot(run, 'normal-start');
}
