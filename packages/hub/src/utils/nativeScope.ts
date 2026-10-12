import type { BrowserProjects } from './browserProjects';

/** In words, what a device asks to read: every project of the person, or one that is named. */
export async function nativeScope(
	resource: string | null,
	projects: Pick<BrowserProjects, 'get'>
): Promise<string> {
	if (resource === 'projects') return 'every shared project you can open, now and later';
	const id = resource?.startsWith('project:') ? resource.slice('project:'.length) : '';
	if (!id) return 'every shared project you can open (the request does not say less)';
	try {
		return `the project “${(await projects.get(id)).name}” only`;
	} catch {
		return 'one project that this account cannot open';
	}
}
