import type { FolderKind } from './unitIdentity.types';
import type { UnitIdentity } from '../unitIdentity';
import { toKebabCase } from '../../../helpers/strings/case';

const folderKinds: Record<string, FolderKind> = {
	adapters: { kind: 'adapter', suffix: 'Adapter' },
	audit: { kind: 'audit' },
	channels: { kind: 'channel', suffix: 'Channel' },
	cli: { kind: 'entry' },
	commands: { kind: 'command', suffix: 'Command' },
	components: { kind: 'component' },
	concerns: { kind: 'concern' },
	config: { kind: 'config', suffix: 'Config' },
	configs: { kind: 'config', suffix: 'Config' },
	controllers: { kind: 'controller', suffix: 'Controller' },
	core: { kind: 'function' },
	decorators: { kind: 'decorator', suffix: 'Decorator' },
	forms: { kind: 'form', suffix: 'Form' },
	guides: { kind: 'guide' },
	helpers: { kind: 'helper', suffix: 'Helper' },
	hooks: { kind: 'hook', suffix: 'Hook' },
	initializers: { kind: 'initializer' },
	jobs: { kind: 'job', suffix: 'Job' },
	lib: { kind: 'module' },
	mailers: { kind: 'mailer', suffix: 'Mailer' },
	middleware: { kind: 'middleware', suffix: 'Middleware' },
	models: { kind: 'model' },
	notifications: { kind: 'notification', suffix: 'Notification' },
	policies: { kind: 'policy', suffix: 'Policy' },
	repositories: { kind: 'repository', suffix: 'Repository' },
	rules: { kind: 'function' },
	serializers: { kind: 'serializer', suffix: 'Serializer' },
	services: { kind: 'service', suffix: 'Service' },
	templates: { kind: 'template' },
	utils: { kind: 'function' },
	validators: { kind: 'validator', suffix: 'Validator' },
	workflows: { kind: 'workflow' }
};

const routeKinds: Record<string, string> = {
	'+page': 'page',
	'+error': 'page',
	'+layout': 'layout',
	'+server': 'endpoint'
};

const rootFolders: Record<string, string> = { scripts: 'script' };

const dbFolders: Record<string, string> = { 'seed-data': 'seeder', migrations: 'migration' };

/** Derives the conventional unit identity of a workspace-relative source path. */
export function unitIdentity(path: string, workspace = ''): UnitIdentity | undefined {
	const segments = path.split('/');
	const derived = segments[0] === 'crates' ? crate(segments) : derive(segments);
	if (!derived?.name) return undefined;
	const prefix = workspace ? `${workspace}.` : '';
	return { ...derived, id: `${prefix}${derived.kind}.${derived.name}` };
}

/** Every file of a Rust crate, including its manifest, belongs to one kernel unit. */
function crate(segments: string[]): Omit<UnitIdentity, 'id'> | undefined {
	return segments.length > 2 ? named('kernel', [segments[1]]) : undefined;
}

function derive(segments: string[]): Omit<UnitIdentity, 'id'> | undefined {
	const [root, folder, ...rest] = segments;
	if (/\.(?:md|json|lock|toml)$/.test(segments.at(-1) ?? '')) return undefined;
	if (root === 'src') return sourceIdentity(segments.length, folder, rest);
	if (root === 'db' && dbFolders[folder]) return named(dbFolders[folder], rest.map(stem));
	if (rootFolders[root]) return named(rootFolders[root], [folder, ...rest].map(stem));
	return undefined;
}

function sourceIdentity(
	depth: number,
	folder: string,
	rest: string[]
): Omit<UnitIdentity, 'id'> | undefined {
	if (depth === 2) return named('entry', [folder.replace(/\.ts$/, '')]);
	if (folder === 'routes') return routeIdentity(rest);
	if (folder === 'lib') return libIdentity(rest);
	if (folder === 'components' && /\.(?:[cm]?[jt]s)$/.test(rest.at(-1) ?? ''))
		return named('function', rest.map(stem));
	return folderKinds[folder] ? folderIdentity(folderKinds[folder], rest) : undefined;
}

function folderIdentity(folder: FolderKind, rest: string[]): Omit<UnitIdentity, 'id'> {
	const parts = rest.map(stem);
	const last = parts.length - 1;
	const suffix = folder.suffix;
	if (suffix && parts[last].endsWith(suffix) && parts[last].length > suffix.length) {
		parts[last] = parts[last].slice(0, -suffix.length);
	}
	return named(folder.kind, parts);
}

function routeIdentity(rest: string[]): Omit<UnitIdentity, 'id'> | undefined {
	const file = rest.at(-1) ?? '';
	const kind = routeKinds[file.split('.')[0]];
	if (!kind) return undefined;
	const route = rest.slice(0, -1);
	const parts = file.startsWith('+error') ? [...route, 'error'] : route;
	return named(kind, parts.length > 0 ? parts : ['root']);
}

function libIdentity(rest: string[]): Omit<UnitIdentity, 'id'> {
	if (rest[0] === 'styles') return named('style', rest.slice(1).map(stem));
	if (rest[0] === 'stores') return named('store', rest.slice(1).map(stem));
	return named('module', rest.map(stem));
}

function named(kind: string, parts: string[]): Omit<UnitIdentity, 'id'> {
	return {
		kind,
		name: parts
			.map((part) => toKebabCase(part))
			.filter(Boolean)
			.join('-')
	};
}

function stem(segment: string): string {
	return segment.replace(/\.(?:svelte\.ts|server\.ts|[a-z0-9]+)$/i, '');
}
