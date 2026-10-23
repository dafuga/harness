import type { ModuleGroup } from '../../configs/development-tooling/moduleGroupsConfig';

/** Scaffold roots precede category folders; route groups preserve public URLs. */
export const moduleFolders = Object.freeze([
	'adapters',
	'app',
	'audit',
	'channels',
	'commands',
	'components',
	'concerns',
	'config',
	'configs',
	'controllers',
	'core',
	'decorators',
	'forms',
	'functions',
	'generators',
	'guides',
	'helpers',
	'hooks',
	'initializers',
	'jobs',
	'lib',
	'mailers',
	'middleware',
	'models',
	'notifications',
	'pages',
	'partials',
	'policies',
	'repositories',
	'routes',
	'rules',
	'serializers',
	'services',
	'shells',
	'stores',
	'templates',
	'utils',
	'validators',
	'workflows'
]);

/** @pure Returns the scaffold root and its remaining category/owner path. */
export function modulePath(path: string): { root: string; parts: string[] } | undefined {
	const match = /^(.*?(?:^|\/)src\/)([^/]+)\/(.+)$/.exec(path);
	if (!match || !moduleFolders.includes(match[2])) return undefined;
	let root = match[1] + match[2];
	const parts = match[3].split('/');
	if (
		match[2] === 'lib' &&
		[
			'stores',
			'utils',
			'helpers',
			'components',
			'services',
			'models',
			'config',
			'adapters'
		].includes(parts[0])
	)
		root += '/' + parts.shift();
	return { root, parts };
}

/** @pure A unit inherits the category folder around its owner; conflicting folders stay unknown. */
export function moduleGroup(
	paths: string[],
	groups: ModuleGroup[]
): Pick<ModuleGroup, 'id' | 'title'> | undefined {
	const found = new Map<string, ModuleGroup>();
	for (const path of paths) {
		const parts = modulePath(path)?.parts ?? [];
		const name = parts[0]?.replace(/^\((.*)\)$/, '$1');
		const group = parts.length > 1 ? groups.find((group) => group.id === name) : undefined;
		if (group) found.set(group.id, group);
	}
	if (found.size === 0) addFolderAliases(found, paths, groups);
	if (found.size !== 1) return undefined;
	const group = [...found.values()][0];
	return { id: group.id, title: group.title };
}

/** @pure Match whole domain words, preferring specific phrases over broad terms. */
export function matchingGroups(text: string, groups: ModuleGroup[]): ModuleGroup[] {
	const normalized =
		' ' +
		text
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim() +
		' ';
	const scored = groups.map((group) => ({
		group,
		score: Math.max(
			0,
			...[group.id, ...group.terms].map((term) => {
				const words = term
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, ' ')
					.trim();
				return words && normalized.includes(' ' + words + ' ') ? words.split(' ').length : 0;
			})
		)
	}));
	const best = Math.max(0, ...scored.map((item) => item.score));
	return best > 0 ? scored.filter((item) => item.score === best).map((item) => item.group) : [];
}

function addFolderAliases(
	found: Map<string, ModuleGroup>,
	paths: string[],
	groups: ModuleGroup[]
): void {
	const folders = groups.flatMap((group) =>
		(group.folders ?? []).map((folder) => ({ group, folder }))
	);
	const aliases = folders.filter(({ folder }) => paths.some((path) => path.startsWith(folder)));
	const length = Math.max(0, ...aliases.map(({ folder }) => folder.length));
	for (const { group, folder } of aliases) if (folder.length === length) found.set(group.id, group);
}
