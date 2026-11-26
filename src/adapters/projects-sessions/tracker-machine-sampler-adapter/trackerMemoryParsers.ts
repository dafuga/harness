// @harness-uid u_3ibkqc3et6
const mib = 1024 * 1024;

/** Linux /proc/meminfo in bytes. Available is MemAvailable: what new work can take without swapping. */
export function parseTrackerMeminfo(text: string) {
	const values = new Map<string, number>();
	for (const line of text.split('\n')) {
		const match = /^(\w+):\s+(\d+)\s*kB/.exec(line);
		if (match) values.set(match[1], Number(match[2]) * 1024);
	}
	const read = (key: string) => values.get(key) ?? 0;
	return {
		total: read('MemTotal'),
		available: values.get('MemAvailable') ?? read('MemFree') + read('Cached') + read('Buffers'),
		swapTotal: read('SwapTotal'),
		swapUsed: read('SwapTotal') - read('SwapFree')
	};
}

/** macOS vm_stat: free, inactive and speculative pages can be handed out without paging. */
export function parseTrackerVmStat(text: string): number {
	const page = Number(/page size of (\d+) bytes/.exec(text)?.[1] ?? 4096);
	const pages = (label: string) =>
		Number(new RegExp(`^Pages ${label}:\\s+(\\d+)\\.`, 'm').exec(text)?.[1] ?? 0);
	return page * (pages('free') + pages('inactive') + pages('speculative'));
}

/** `sysctl -n vm.swapusage`, in bytes. */
export function parseTrackerSwapUsage(text: string) {
	const read = (key: string) => {
		const match = new RegExp(`${key} = ([\\d.]+)([KMG])`).exec(text);
		if (!match) return 0;
		return Number(match[1]) * { K: 1024, M: mib, G: 1024 * mib }[match[2] as 'K' | 'M' | 'G'];
	};
	return { swapTotal: read('total'), swapUsed: read('used') };
}

/** kern.memorystatus_vm_pressure_level: 1 normal, 2 warn, 4 critical. */
export function parseTrackerMemoryPressure(
	text: string
): 'normal' | 'warn' | 'critical' | undefined {
	const level = Number(text.trim());
	if (level >= 4) return 'critical';
	if (level >= 2) return 'warn';
	return level === 1 ? 'normal' : undefined;
}

export function parseTrackerPressureFree(text: string): number | undefined {
	const match = /System-wide memory free percentage:\s*(\d+)%/.exec(text);
	return match ? Number(match[1]) : undefined;
}
