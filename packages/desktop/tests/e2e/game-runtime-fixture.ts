import scenario from '../../../../specification/scenarios/game-authoring.json' with { type: 'json' };
import { recordCapture } from '../../../../src/utils/record-capture/recordCapture';
import type { Page } from '../../../../test/support/browserTest';
import { mkdir, appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
const desktop = resolve(import.meta.dirname, '../..');
const starts = new WeakMap<Page, number>();
/** Cumulative standard-flow timing, never an isolated component benchmark. */
export function beginGameFlow(page: Page) {
	starts.set(page, performance.now());
}
export async function recordGameState(page: Page, state: string) {
	if (!process.env.HARNESS_EVIDENCE_DIR) return;
	const started = starts.get(page);
	const declared = scenario.states.find((item) => item.id === state);
	const viewport = scenario.viewports.find((item) => item.width === page.viewportSize()?.width)?.id;
	if (started === undefined || !declared || !viewport)
		throw new Error('Game flow measurement needs a started flow and declared state/viewport.');
	const elapsedMs = performance.now() - started;
	const cdp = await page.context().newCDPSession(page);
	const heap = await cdp.send('Runtime.getHeapUsage');
	await cdp.detach();
	const units = [...declared.units];
	if (!state.endsWith('-creation')) units.push('desktop.component.game-navigation-guard');
	if (state.endsWith('-play')) units.push('desktop.function.game-render-options');
	const measurements = units.flatMap((unit) => {
		const common = {
			unit,
			workload: 'native-authoring-' + state + '-' + viewport,
			target: 'process',
			samples: 1
		};
		return [
			{
				...common,
				metric: 'native-flow-elapsed-ms',
				unitOfMeasure: 'ms',
				value: elapsedMs,
				method:
					'Cumulative wall time from the native authoring flow start to this settled named state. Includes shared UI, IPC, fixtures, assertions and earlier captures; not isolated component timing or production provider latency.'
			},
			{
				...common,
				metric: 'renderer-js-heap-bytes',
				unitOfMeasure: 'bytes',
				value: heap.usedSize,
				method:
					'Whole Chromium renderer V8 heap at this settled workload state, including shared UI and all participants. Excludes GPU and Electron main process; not isolated unit memory.'
			}
		];
	});
	recordCapture(
		{
			evidence: 'game-authoring-components',
			kind: 'benchmark',
			state,
			viewport,
			file: 'game-components-' + state + '-' + viewport + '.json',
			mediaType: 'application/json'
		},
		JSON.stringify({ measurements })
	);
}

export async function recordRuntime(page: Page, started: number, dimension: string) {
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode()));
	});
	const elapsedMs = performance.now() - started;
	const cdp = await page.context().newCDPSession(page);
	const heap = await cdp.send('Runtime.getHeapUsage');
	await cdp.detach();
	const viewport = scenario.viewports.find((v) => v.width === page.viewportSize()?.width)?.id;
	if (viewport) recordGameRuntime({ dimension, viewport, elapsedMs, heap: heap.usedSize });
	const directory = resolve(desktop, '../../.cache/game-authoring-evidence');
	await mkdir(directory, { recursive: true });
	await appendFile(
		join(directory, 'runtime.ndjson'),
		JSON.stringify({
			revision:
				process.env.HARNESS_VERIFY_REVISION ??
				execFileSync('git', ['rev-parse', 'HEAD'], {
					cwd: desktop,
					encoding: 'utf8'
				}).trim(),
			dimension,
			viewport: page.viewportSize(),
			workload: 'Native page reload to saved game and ready canvas',
			elapsedMs,
			pageHeapBytes: heap.usedSize,
			memoryScope: 'Whole renderer V8 heap; excludes GPU and main process'
		}) + '\n'
	);
}

function recordGameRuntime({
	dimension,
	viewport,
	elapsedMs,
	heap
}: {
	dimension: string;
	viewport: string;
	elapsedMs: number;
	heap: number;
}) {
	if (process.env.HARNESS_EVIDENCE_DIR)
		recordCapture(
			{
				evidence: 'game-native-runtime',
				kind: 'benchmark',
				state: dimension + '-reopened',
				viewport,
				file: `game-native-runtime-${dimension}-${viewport}.json`,
				mediaType: 'application/json'
			},
			JSON.stringify({
				measurements: [
					{
						unit: 'desktop.page.game',
						metric: 'native-page-ready-ms',
						unitOfMeasure: 'ms',
						value: elapsedMs,
						workload: `saved-${dimension}-${viewport}`,
						target: 'process',
						samples: 1,
						method:
							'Wall time from reload through saved game and ready canvas, including Electron IPC and shared code; not isolated component timing.'
					},
					{
						unit: 'desktop.page.game',
						metric: 'renderer-js-heap-bytes',
						unitOfMeasure: 'bytes',
						value: heap,
						workload: `saved-${dimension}-${viewport}`,
						target: 'process',
						samples: 1,
						method:
							'Chromium Runtime.getHeapUsage after the ready canvas; whole renderer JavaScript heap, excluding GPU and main process, not isolated component memory.'
					}
				]
			})
		);
}
