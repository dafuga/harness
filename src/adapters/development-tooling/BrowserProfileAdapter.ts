import { recordCapture } from '../../utils/record-capture/recordCapture';
import { captureLineSchema } from '../../core/verifyTypes';

/** The browser driver supplies actual observations; no browser package enters the SDK. */
export interface BrowserProfileSurface {
	navigation(): Promise<{ name: string; duration: number } | null>;
	url(): string;
	heap(): Promise<number>;
	viewport(): { width: number; height: number };
}

export interface BrowserProfileInput {
	units: string[];
	state: string;
	workload: string;
	file: string;
	viewport?: string;
	buildId: string;
	evidence?: string;
}

/** Shared renderer measurements retain their actual workload and never claim isolated unit cost. */
export class BrowserProfileAdapter {
	constructor(private readonly browser: BrowserProfileSurface) {}

	async capture(input: BrowserProfileInput): Promise<void> {
		const navigation = await this.browser.navigation();
		if (navigation?.name !== this.browser.url()) return;
		if (!input.units.length) return;
		const heap = await this.browser.heap();
		if (!(navigation.duration > 0) || !(heap > 0))
			throw new Error('A required page workload has no positive navigation and heap readings.');
		const measurements = browserReadings(input, this.browser.viewport(), {
			duration: navigation.duration,
			heap
		});
		const line = captureLineSchema.parse({
			evidence: input.evidence ?? 'page-benchmarks',
			kind: 'benchmark',
			state: input.state,
			file: input.file,
			mediaType: 'application/json',
			...(input.viewport ? { viewport: input.viewport } : {})
		});
		recordCapture(line, JSON.stringify({ measurements }));
	}
}

/** A shared document workload is associated only with its supplied, observed participants. */
function browserReadings(
	input: BrowserProfileInput,
	viewport: { width: number; height: number },
	values: { duration: number; heap: number }
) {
	const { width, height } = viewport;
	return input.units.flatMap((unit) => {
		const common = { unit, workload: input.workload, target: 'module', samples: 1 };
		return [
			{
				...common,
				metric: 'browser-navigation-ms',
				unitOfMeasure: 'ms',
				value: values.duration,
				method: `Whole compiled renderer NavigationTiming through loadEventEnd, including shared code; ${width}x${height}; build ${input.buildId}.`
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
