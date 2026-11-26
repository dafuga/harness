// @harness-uid u_3wzjmmikbs
/**
 * Mask obvious `key=value` secrets and known token formats in box job output before it is stored.
 */
export function redactTrackerJobOutput(output: string): string {
	return output
		.replace(
			/((?:api[_-]?key|token|secret|password|passwd|authorization|bearer)\s*[:=]\s*)\S+/gi,
			'$1[redacted]'
		)
		.replace(/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, '[redacted]')
		.replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[redacted]');
}
