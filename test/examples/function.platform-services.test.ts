import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	classifyProcess,
	macAuthority,
	platformServices
} from '../../src/utils/reports-media/platformServices';
import { stillPrivate } from '../../src/utils/reports-media/run-isolated/stillPrivate';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';
import {
	started,
	withFakeSelector,
	record,
	writeSelector,
	makeProbes,
	privateFacts,
	serviceFacts
} from './function.platform-services.fixtures';

const known = { pid: 4812, started };

test('Reads the selected Xcode authority synchronously', async () => {
	await withFakeSelector(async ({ developer }) => {
		const authority = macAuthority();
		expect(authority?.root).toBe(developer);
		expect(authority?.rootRequirement).toContain('com.apple.dt.Xcode');
		expect(authority?.services[0].requirement).toContain('anchor apple');
		record('macAuthority', 'reads-the-selected-xcode-authority-synchronously', [
			{
				name: 'the selector points into a canonical Xcode bundle',
				input: { selectorOutput: 'Xcode.app/Contents/Developer' },
				output: {
					root: 'Xcode.app/Contents/Developer',
					rootCode: 'Xcode.app',
					rootRequirement: authority?.rootRequirement,
					services: authority?.services
				}
			}
		]);
	});
});

test('Probes the selected Xcode authority asynchronously', async () => {
	await withFakeSelector(async ({ developer, selector }) => {
		const authority = await platformServices();
		await writeSelector(selector, '/missing-xcode/Contents/Developer');
		const missing = await platformServices();
		expect(authority?.root).toBe(developer);
		expect(authority?.services[0].path).toBe('usr/bin/ibtoold');
		expect(missing).toBeNull();
		record('platformServices', 'probes-the-selected-xcode-authority-asynchronously', [
			{
				name: 'the process probe selects an Xcode developer directory',
				input: { command: 'xcode-select -p', selectorOutput: 'Xcode.app/Contents/Developer' },
				output: {
					root: 'Xcode.app/Contents/Developer',
					rootCode: 'Xcode.app',
					services: authority?.services
				}
			},
			{
				name: 'the selected directory does not resolve to Xcode',
				input: { command: 'xcode-select -p', selectorOutput: '/missing-xcode/Contents/Developer' },
				output: missing
			}
		]);
	});
});

test('Classifies ordinary command processes as private', async () => {
	const verdict = await classifyProcess(known, {
		authority: async () => null,
		group: 900,
		probes: makeProbes(privateFacts, '/usr/bin/python3')
	});
	expect(verdict).toEqual({
		standing: 'private',
		reason: "the command's own",
		executable: '/usr/bin/python3'
	});
	record('classifyProcess', 'classifies-ordinary-command-processes-as-private', [
		{
			name: 'a tracked Python process still belongs to the command',
			input: { known, observed: privateFacts, executable: '/usr/bin/python3' },
			output: verdict
		}
	]);
});

test('Protects shared-service candidates without authority', async () => {
	const verdict = await classifyProcess(known, {
		authority: async () => null,
		group: 900,
		probes: makeProbes(serviceFacts, '/Applications/Xcode.app/Contents/Developer/usr/bin/ibtoold')
	});
	expect(verdict.standing).toBe('protected');
	expect(verdict.reason).toBe('no developer tools vouch for it');
	record('classifyProcess', 'protects-shared-service-candidates-without-authority', [
		{
			name: 'ibtoold is not private without a developer authority',
			input: { known, observed: serviceFacts, authority: null },
			output: verdict
		}
	]);
});

test('Delegates a vouched service after system handoff', async () => {
	await withTempDir('vouched-platform-service-', async (directory) => {
		const bundle = join(directory, 'Xcode.app');
		await mkdir(join(bundle, 'Contents/_CodeSignature'), { recursive: true });
		await mkdir(join(bundle, 'Contents/Developer'), { recursive: true });
		const rootCode = await realpath(bundle);
		const root = join(rootCode, 'Contents/Developer');
		await writeFile(join(rootCode, 'Contents/Info.plist'), 'fixture');
		await writeFile(join(rootCode, 'Contents/_CodeSignature/CodeResources'), 'fixture');
		const authority = {
			root,
			rootCode,
			rootRequirement: 'identifier "fixture.xcode"',
			services: [{ path: 'usr/bin/ibtoold', requirement: 'identifier "fixture.ibtool"' }]
		};
		const known = { pid: 4812, started };
		const executable = join(root, 'usr/bin/ibtoold');
		const verdict = await classifyProcess(known, {
			authority: async () => authority,
			group: 900,
			probes: makeProbes(serviceFacts, executable, true)
		});
		expect(verdict.standing).toBe('delegated');
		expect(verdict.reason).toContain('adopted by the system');
		expect(verdict.executable).toBe(executable);
		record('classifyProcess', 'delegates-a-vouched-service-after-system-handoff', [
			{
				name: 'signed ibtoold left its command and the system adopted it',
				input: {
					known,
					observed: serviceFacts,
					executable: 'Xcode.app/Contents/Developer/usr/bin/ibtoold',
					authority: 'canonical Xcode fixture',
					signatureChecks: true
				},
				output: {
					standing: verdict.standing,
					reason: verdict.reason,
					executable: 'Xcode.app/Contents/Developer/usr/bin/ibtoold'
				}
			}
		]);
	});
});

test('Rechecks process identity and executable before signaling', async () => {
	const context = (executable: string, facts = privateFacts) => ({
		authority: async () => null,
		group: 900,
		probes: makeProbes(facts, executable)
	});
	const judged = await classifyProcess(known, context('/usr/bin/python3'));
	const still = await stillPrivate(known, judged.executable, context('/usr/bin/python3'));
	const changed = await stillPrivate(known, judged.executable, context('/usr/bin/ruby'));
	const replaced = await stillPrivate(
		known,
		judged.executable,
		context('/usr/bin/python3', { ...privateFacts, started: 'Sat Nov 15 12:34:56 2026' })
	);
	const shared = await stillPrivate(
		known,
		judged.executable,
		context('/Applications/Xcode.app/Contents/Developer/usr/bin/ibtoold')
	);
	expect(judged.standing).toBe('private');
	expect({ still, changed, replaced, shared }).toEqual({
		still: true,
		changed: false,
		replaced: false,
		shared: false
	});
	record('stillPrivate', 'rechecks-process-identity-and-executable-before-signaling', [
		{
			name: 'the private process keeps its identity and executable',
			input: { known, judgedAs: '/usr/bin/python3', live: '/usr/bin/python3' },
			output: still
		},
		{
			name: 'the live executable changes before the signal',
			input: { known, judgedAs: '/usr/bin/python3', live: '/usr/bin/ruby' },
			output: changed
		},
		{
			name: 'the PID now has a different start time',
			input: { known, observedStarted: 'Sat Nov 15 12:34:56 2026', judgedAs: '/usr/bin/python3' },
			output: replaced
		},
		{
			name: 'a guarded service is never considered private',
			input: {
				known,
				judgedAs: '/usr/bin/python3',
				live: '/Applications/Xcode.app/Contents/Developer/usr/bin/ibtoold'
			},
			output: shared
		}
	]);
});
