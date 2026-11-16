// @harness-uid u_3wlbqeyf7m
/* eslint-disable max-classes-per-file */
export class UnsupportedCpuProcessPlatformError extends Error {
	override name = 'UnsupportedCpuProcessPlatformError';
}

export class CpuCountersUnavailableError extends Error {
	override name = 'CpuCountersUnavailableError';
}
