// @harness-uid u_6shfrcvyqy
/** The stable id of a unit: `u_` and ten base32 letters. */
export const uidPattern = /^u_[a-z2-7]{10}$/;
export const unitIdPattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const dependencyVias = [
	'import',
	'reexport',
	'dynamic-import',
	'require',
	'url',
	'style-import',
	'process',
	'http',
	'wasm',
	'contract'
] as const;
export const runtimeKinds = ['module', 'wasm', 'process', 'http'] as const;
export const performanceMetrics = [
	'latency-cold-ms',
	'latency-warm-ms',
	'latency-floor-ms',
	'throughput-ops',
	'memory-bytes'
] as const;

/** Performance may drift this far from its baseline; only a recorded approval may change it. */
export const performanceTolerance = 0.05;
