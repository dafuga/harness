export const scaffoldKinds = [
	'controller',
	'service',
	'decorator',
	'component',
	'test',
	'feature',
	'migration',
	'view',
	'layout',
	'api',
	'store',
	'hook',
	'e2e',
	'adapter',
	'repository',
	'validator',
	'serializer',
	'policy',
	'job',
	'notification',
	'seeder',
	'command',
	'util'
] as const;

export type PieceKind = (typeof scaffoldKinds)[number];

const appOnlyScaffolds = new Set<PieceKind>([
	'component',
	'view',
	'layout',
	'api',
	'store',
	'hook',
	'e2e'
]);

export function isAppOnlyScaffold(kind: PieceKind): boolean {
	return appOnlyScaffolds.has(kind);
}
