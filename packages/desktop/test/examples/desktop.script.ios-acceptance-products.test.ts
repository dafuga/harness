import { mkdtempSync, rmSync } from 'node:fs';
import type * as Fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { acceptanceProducts, normalProduct } from '../../scripts/ios-acceptance-products';
import { reading, recordOf, thrownBy } from './desktop.script.ios-acceptance-products.fixture';
import type { AcceptanceLike } from './desktop.script.ios-acceptance-products.test.types';

// The build and simulator helpers are replaced by fakes that record their calls and write the
// App binaries a real build would leave, so the unit's own orchestration runs unchanged.
const fake = vi.hoisted(() => ({ root: '', failOn: '', calls: [] as string[] }));

vi.mock('../../scripts/ios-products', async () => {
	const fs = await vi.importActual<typeof Fs>('node:fs');
	const built = (configuration: string) => `${fake.root}/DerivedData/${configuration}/App.app`;
	return {
		desktopRoot: '/example/desktop',
		fixtureProduct: 'example/fixture/App.app',
		builtProduct: built,
		changedCopy: (_source: string, target: string) => target,
		productFacts: (product: string) => {
			const plain = /DerivedData\/(Debug|Release)\//.test(product);
			return {
				path: product.replace(`${fake.root}/`, ''),
				executable: `exe:${product.length}`,
				signature: 'ad hoc, no team, no account',
				localNetworking: !plain,
				inspectable: !plain
			};
		},
		tool: (command: string[]) => {
			const line = command.join(' ');
			fake.calls.push(line);
			if (fake.failOn && line.includes(fake.failOn)) throw new Error(`${line} failed (1)`);
			for (const configuration of ['Debug', 'Release']) {
				fs.mkdirSync(built(configuration), { recursive: true });
				fs.writeFileSync(`${built(configuration)}/App`, 'binary');
			}
			return '';
		},
		tried: () => ({ code: 2, output: 'needs a Debug build' })
	};
});

vi.mock('../../scripts/ios-acceptance-source', () => ({
	missing: () => [],
	moved: () => [],
	nativeSources: [],
	rendererSources: [],
	sourceFiles: () => new Map<string, string>(),
	tree: () =>
		new Map([
			['index.html', 'a'],
			['app.js', 'b']
		]),
	treeDigest: (files: Map<string, string>) => `digest:${files.size}`
}));

vi.mock('../../scripts/ios-build-options', () => ({ fixtureNeedsDebug: 'needs a Debug build' }));
vi.mock('../../scripts/ios-acceptance-run', () => ({
	pause: () => Promise.resolve(),
	shot: (_run: unknown, name: string) => {
		fake.calls.push(`shot ${name}`);
		return Promise.resolve();
	}
}));
vi.mock('../../scripts/ios-acceptance-simulator', () => ({
	install: (udid: string) => {
		fake.calls.push(`install ${udid}`);
	},
	launch: (udid: string) => {
		fake.calls.push(`launch ${udid}`);
	},
	running: () => true
}));

function setupRoot(): string {
	fake.root = mkdtempSync(join(tmpdir(), 'ios-acceptance-products-'));
	fake.calls = [];
	fake.failOn = '';
	return fake.root;
}

test('builds the four products and proves the renderer they carry', () => {
	const root = setupRoot();
	try {
		const { ledger, record } = recordOf();
		const result = acceptanceProducts(record, reading());

		expect(ledger.begun).toEqual(['Products']);
		expect(ledger.checks.every(([ok]) => ok)).toBe(true);
		expect(result.releaseCopy).toBe('/example/desktop/.cache/ios/acceptance/Release/App.app');
		expect(result.renderer).toEqual({ built: 'digest:2', copied: 'digest:2', files: 2 });
		expect(Object.keys(result.facts)).toEqual(['debug', 'release', 'fixtureCopy', 'releaseCopy']);
		expect(result.facts.debug).toMatchObject({ localNetworking: false, inspectable: false });

		const flags = Object.fromEntries(
			Object.entries(result.facts).map(([key, fact]) => [
				key,
				{ localNetworking: fact.localNetworking, inspectable: fact.inspectable }
			])
		);
		recordExampleCases(
			{
				unitId: 'desktop.script.ios-acceptance-products',
				symbol: 'acceptanceProducts',
				state: 'builds-the-five-products-and-proves-the-renderer-they-carry',
				evidence: 'examples-cases',
				file: 'builds-the-five-products-and-proves-the-renderer-they-carry.json'
			},
			[
				{
					name: 'relay and inspection flags of the five products',
					input: ['debug', 'release', 'fixtureCopy', 'releaseCopy'],
					output: flags
				},
				{
					name: 'renderer proof of the built and copied files',
					input: 'renderer',
					output: result.renderer
				},
				{ name: 'location of the Release copy', input: 'releaseCopy', output: result.releaseCopy }
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('stops with the tool error when a build step fails', () => {
	const root = setupRoot();
	try {
		fake.failOn = 'cap:sync';
		const { ledger, record } = recordOf();
		const error = thrownBy(() => acceptanceProducts(record, reading()));

		expect(error).toBeInstanceOf(Error);
		expect(error).toMatchObject({ message: 'bun run cap:sync failed (1)' });
		expect(ledger.begun).toEqual(['Products']);

		recordExampleCases(
			{
				unitId: 'desktop.script.ios-acceptance-products',
				symbol: 'acceptanceProducts',
				state: 'stops-with-the-tool-error-when-a-build-step-fails',
				evidence: 'examples-cases',
				file: 'stops-with-the-tool-error-when-a-build-step-fails.json'
			},
			[
				{
					name: 'cap sync step fails with its exit code',
					input: ['bun', 'run', 'cap:sync'],
					error: { name: error.name, message: error.message }
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('starts the normal Debug product and keeps it running', async () => {
	fake.calls = [];
	const { ledger, record } = recordOf();
	const run = {
		record,
		page: {},
		udid: 'EXAMPLE-UDID',
		controlOrigin: 'example-control',
		project: { id: 'example', name: 'Example' },
		output: '/example/out'
	} as unknown as AcceptanceLike;

	await normalProduct(run);

	expect(ledger.begun).toEqual(['Normal product']);
	expect(ledger.checks).toEqual([
		[true, 'the normal Debug product starts on the simulator'],
		[true, 'and is still running a moment later']
	]);
	expect(fake.calls).toEqual(['install EXAMPLE-UDID', 'launch EXAMPLE-UDID', 'shot normal-start']);

	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-products',
			symbol: 'normalProduct',
			state: 'starts-the-normal-debug-product-and-keeps-it-running',
			evidence: 'examples-cases',
			file: 'starts-the-normal-debug-product-and-keeps-it-running.json'
		},
		[
			{ name: 'simulator steps for the Debug product', input: 'EXAMPLE-UDID', output: fake.calls },
			{
				name: 'checks recorded in the normal product phase',
				input: 'Normal product',
				output: ledger.checks.map(([ok, text]) => ({ ok, text }))
			}
		]
	);
});
