/** @pure Normalize a public GitHub remote address without carrying credentials or URL suffixes. */
export function githubRepositoryUrl(remote: string): string | undefined {
	const found = remote
		.trim()
		.match(
			/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([a-z\d-]+)\/([a-z\d._-]+?)(?:\.git)?\/?$/i
		);
	if (!found) return undefined;
	return `https://github.com/${found[1]}/${found[2]}`;
}

/** @pure Address one regular repository path at an exact commit, or omit an unsafe destination. */
export function githubSourceUrl(
	repository: string | undefined,
	commit: string,
	path: string
): string | undefined {
	const base = githubRepositoryUrl(repository ?? '');
	const parts = path.split('/');
	if (!base || !commit.match(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)) return undefined;
	if (parts.some((part) => !part || part === '.' || part === '..')) return undefined;
	return `${base}/blob/${commit}/${parts.map(encodeURIComponent).join('/')}`;
}
