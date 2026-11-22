// @harness-uid u_34r2rrehaa
/** Explicit child environment; callers may supply task-specific keys deliberately. */
export function commandEnvironment(
	extra: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
	const result: Record<string, string | undefined> = {};
	for (const key of [
		'PATH',
		'HOME',
		'USER',
		'LOGNAME',
		'SHELL',
		'TMPDIR',
		'TEMP',
		'TMP',
		'LANG',
		'LC_ALL',
		'TZ',
		'SYSTEMROOT',
		'CI',
		'NODE_OPTIONS',
		'NODE_PATH',
		'BUN_INSTALL',
		'BUN_OPTIONS',
		'SSL_CERT_FILE',
		'SSL_CERT_DIR',
		'HTTP_PROXY',
		'HTTPS_PROXY',
		'ALL_PROXY',
		'NO_PROXY',
		'http_proxy',
		'https_proxy',
		'all_proxy',
		'no_proxy',
		'XDG_CONFIG_HOME'
	])
		if (process.env[key] !== undefined) result[key] = process.env[key];
	return { ...result, ...extra };
}
