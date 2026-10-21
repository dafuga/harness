/** Runner integration is internal and is enabled only for explicitly requested evidence. */
export function sourceProfilePlugin(_root: string) {
	return { name: 'harness-source-profiles' };
}
