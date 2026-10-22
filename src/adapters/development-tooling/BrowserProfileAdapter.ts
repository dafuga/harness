import { evidenceRequested, recordCapture } from '../../utils/record-capture/recordCapture';
import { captureLineSchema } from '../../core/verifyTypes';
import { PerformanceProfileService } from '../../services/PerformanceProfileService';

/** The browser driver supplies actual observations; no browser package enters the SDK. */
export interface BrowserProfileSurface {
	navigation(): Promise<{ name: string; duration: number } | null>;
	url(): string;
	heap(): Promise<number>;
	viewport(): { width: number; height: number };
	identity?(): Promise<string | null>;
}

export interface BrowserProfileInput {
	units: string[];
	state: string;
	workload: string;
	file: string;
	viewport?: string;
	buildId?: string;
	evidence?: string;
	note?: string;
}

/** Shared renderer measurements retain their actual workload and never claim isolated unit cost. */
export class BrowserProfileAdapter {
	constructor(private readonly browser: BrowserProfileSurface) {}

	async capture(input: BrowserProfileInput, operation?: () => Promise<void>): Promise<void> {
		if (!evidenceRequested() || !input.units.length) {
			await operation?.();
			return;
		}
		const duration = await browserDuration(this.browser, input, operation);
		if (duration === null) return;
		const heap = await this.browser.heap();
		if (!(duration > 0) || !(heap > 0))
			throw new Error('A required page workload has no positive navigation and heap readings.');
		const buildId = await browserIdentity(this.browser, input);
		const measurements = browserReadings({ ...input, buildId }, this.browser.viewport(), {
			duration,
			heap,
			workflow: Boolean(operation)
		});
		const line = captureLineSchema.parse({
			evidence: input.evidence ?? 'page-benchmarks',
			kind: 'benchmark',
			state: input.state,
			file: input.file,
			mediaType: 'application/json',
			note: input.note,
			...(input.viewport ? { viewport: input.viewport } : {})
		});
		recordCapture(line, JSON.stringify({ measurements }));
	}
}

async function browserIdentity(browser: BrowserProfileSurface, input: BrowserProfileInput) {
	const buildId = (await browser.identity?.()) ?? input.buildId;
	if (!buildId) throw new Error('Browser workload has no compiled build identity');
	return buildId;
}

/** A shared document workload is associated only with its supplied, observed participants. */
function browserReadings(
	input: BrowserProfileInput,
	viewport: { width: number; height: number },
	values: { duration: number; heap: number; workflow: boolean }
) {
	const { width, height } = viewport;
	return input.units.flatMap((unit) => {
		const common = {
			unit,
			workload: input.workload,
			target: 'module',
			samples: 1,
			...(input.note ? { partial: input.note } : {})
		};
		return [
			{
				...common,
				metric: values.workflow ? 'latency-browser-workflow-ms' : 'browser-navigation-ms',
				unitOfMeasure: 'ms',
				value: values.duration,
				method: values.workflow
					? `One actual browser workflow, including shared code, readiness assertions and browser-protocol overhead, without replay or isolated unit attribution; ${width}x${height}; build ${input.buildId}.`
					: `Whole compiled renderer NavigationTiming through loadEventEnd, including shared code; ${width}x${height}; build ${input.buildId}.`
			},
			{
				...common,
				metric: 'browser-js-heap-bytes',
				unitOfMeasure: 'bytes',
				value: values.heap,
				method:
					'Chromium Runtime.getHeapUsage after fonts and images settled; whole renderer JavaScript heap, including shared code, not isolated unit memory or process RSS.'
			}
		];
	});
}

/** Explicit actions have their own elapsed time; a soft destination never borrows NavigationTiming. */
async function browserDuration(
	browser: BrowserProfileSurface,
	input: BrowserProfileInput,
	operation?: () => Promise<void>
): Promise<number | null> {
	if (operation) {
		const readings = await new PerformanceProfileService().measure(
			{
				unit: input.units[0],
				workload: input.workload,
				rounds: 1,
				iterations: 1,
				warmups: 0
			},
			operation
		);
		return readings[0].value;
	}
	const navigation = await browser.navigation();
	return navigation?.name === browser.url() ? navigation.duration : null;
}
