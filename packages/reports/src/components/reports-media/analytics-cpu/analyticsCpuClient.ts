// @harness-uid u_ym3ca64mrl
import { CpuSampleUnavailableError } from './analyticsCpuClient.types';
import type { CpuState } from '../../../utils/reports-media/analyticsCpuClient';
import type { CpuSnapshot } from '../../../../../../src/utils/development-tooling/cpuMetrics';

export function analyticsCpuClient(update: (sample: CpuState) => void) {
	let active = true,
		pending = false;
	const controller = new AbortController();
	async function refresh(): Promise<void> {
		if (!active || pending) return;
		pending = true;
		try {
			const response = await fetch('/api/analytics-cpu', {
				cache: 'no-store',
				signal: controller.signal
			});
			if (!response.ok) throw new CpuSampleUnavailableError('CPU sample unavailable.');
			const sample = (await response.json()) as CpuSnapshot;
			if (active) update(sample);
		} catch {
			if (active) update(null);
		} finally {
			pending = false;
		}
	}
	const timer = setInterval(() => {
		if (document.visibilityState === 'visible') void refresh();
	}, 5000);
	void refresh();
	return {
		refresh,
		stop: () => {
			active = false;
			clearInterval(timer);
			controller.abort();
		}
	};
}
