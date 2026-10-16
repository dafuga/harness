/**
 * TEST ONLY. The native acceptance of the iOS app, repeatable on one machine:
 *
 *   cd packages/desktop && bun run ios:acceptance
 *
 * It builds the simulator products from the working tree, starts a fixture computer of its own
 * (the real relay Worker in workerd and the real RemoteHostService over a synthetic project, on
 * free ports of 127.0.0.1), boots a simulator of its own, and drives the real web view of the
 * app through WebKit's inspector: scanning, approval, Keychain, relaunch, media, saved copies,
 * reconnect, revocation, and what a Release product does. Every claim is an assertion by name.
 *
 * A simulator has no camera. The scans of the pairing phases come from the synthetic scanner
 * of an isolated copy of the native source; the products of the real source are shown to have
 * their camera only. No camera of a device was used, and none is claimed.
 *
 * It is automation by a tool, not a person's check: nothing the system draws is pressed, so the
 * camera prompt of the system is not part of it. It proves nothing about a deployed relay, a
 * real computer, a physical phone or a build signed for a device. It uses no account, prints
 * no code and no key, and touches no other simulator and no other fixture.
 *
 * Screenshots and report.json go to work/mobile/ios-acceptance/, which Git ignores.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SimulatorPage } from './ios-acceptance-page';
import { pairing } from './ios-acceptance-pairing';
import { acceptanceProducts, normalProduct } from './ios-acceptance-products';
import { AcceptanceRecord } from './ios-acceptance-record';
import { releaseRefusal } from './ios-acceptance-release';
import type { Acceptance } from './ios-acceptance-run';
import { cameraOnly, scanEndings } from './ios-acceptance-scanning';
import {
	acceptanceDevice,
	deviceName,
	inspectorSocket,
	install,
	shutdown
} from './ios-acceptance-simulator';
import { movedSources, named, readSources, revision, toolsProof } from './ios-acceptance-source';
import type { SourceReading } from './ios-acceptance-source';
import { reconnection, savedCopies, workspace } from './ios-acceptance-workspace';
import { desktopRoot, fileDigest, fixtureProduct } from './ios-products';
import { scanFixtureProduct } from './ios-scan-fixture';
import { startRemoteFixture } from './remote-fixture-host';

const output = resolve(desktopRoot, '../../work/mobile/ios-acceptance');
const notice =
	'TEST ONLY. Automated through WebKit inspector on a simulator, against a synthetic computer ' +
	'on this machine. Every scan of the pairing phases came from a synthetic scanner in an ' +
	'isolated test copy; no camera was used. Not a manual check; no system prompt was pressed. ' +
	'Not proof of a deployed relay, a real computer, a physical phone or a build signed for a device.';

/** The phases on the device, in order; the first that cannot go on ends them. */
async function onDevice(run: Acceptance, releaseCopy: string): Promise<void> {
	try {
		await normalProduct(run);
		install(run.udid, fixtureProduct);
		run.record.begin('Debug product of the real source');
		await cameraOnly(run, 'Debug');
		install(run.udid, scanFixtureProduct);
		await scanEndings(run);
		await pairing(run);
		await workspace(run);
		await savedCopies(run);
		await reconnection(run);
		install(run.udid, releaseCopy);
		await releaseRefusal(run);
	} catch (error) {
		run.record.stopped(error);
	}
	await run.page.reset();
}

/**
 * A run names the source it was made from only if that source held still. Other people work in
 * the same tree, so everything is read again at the end; a file that moved fails the run.
 */
function heldStill(record: AcceptanceRecord, read: SourceReading): void {
	const changed = movedSources(read, readSources());
	const which = changed.length ? `; changed: ${changed.slice(0, 6).join(', ')}` : '';
	record.begin('Source');
	record.check(
		changed.length === 0,
		`no source the run was made from changed during the run${which}`
	);
}

/**
 * What is tested is made first: the products, then the fixture computer. The simulator and the
 * fixture are the run's own and are ended with it, also when a phase fails.
 */
async function tested(record: AcceptanceRecord) {
	const read = readSources();
	const products = acceptanceProducts(record, read);
	const device = acceptanceDevice();
	try {
		const publicDirectory = resolve(output, 'fixture');
		const quiet = { publicDirectory, log: () => undefined, approval: 'asked' as const };
		const fixture = await startRemoteFixture(quiet);
		const { controlOrigin, relayOrigin, hostId, project } = fixture;
		const simulator = { socketPath: inspectorSocket(device.udid), runtime: device.runtime };
		const page = new SimulatorPage(simulator);
		const run = { record, page, udid: device.udid, controlOrigin, project, output };
		await onDevice(run, products.releaseCopy).finally(() => fixture.stop());
		heldStill(record, read);
		return {
			source: {
				...revision(),
				renderer: named(read.renderer),
				native: named(read.native),
				fixtureComputer: named(read.fixtureComputer)
			},
			simulator: { name: deviceName, runtime: device.runtime },
			products: products.facts,
			renderer: products.renderer,
			fixture: { relayOrigin, controlOrigin, hostId, project }
		};
	} finally {
		shutdown(device.udid);
	}
}

async function main(): Promise<number> {
	rmSync(output, { recursive: true, force: true });
	mkdirSync(output, { recursive: true });
	const record = new AcceptanceRecord();
	const startedAt = new Date().toISOString();
	const made = await tested(record);
	const shots = readdirSync(output).filter((file) => file.endsWith('.png'));
	const report = {
		notice,
		startedAt,
		finishedAt: new Date().toISOString(),
		tools: toolsProof(),
		...made,
		passed: record.passed,
		failed: record.failed,
		checks: record.checks,
		screenshots: shots.map((file) => ({ file, sha256: fileDigest(resolve(output, file)) }))
	};
	writeFileSync(resolve(output, 'report.json'), JSON.stringify(report, null, '\t'));
	console.log(`\n${record.passed} passed, ${record.failed} failed. Report: ${output}/report.json`);
	return record.failed ? 1 : 0;
}

void main().then(
	(code) => process.exit(code),
	(error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
);
