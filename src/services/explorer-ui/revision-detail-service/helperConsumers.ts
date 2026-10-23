import type { Context, Unit } from './helperConsumers.types';
import type { HelperTree, HelperConsumer } from '../../../utils/explorer-ui/helperConsumers';
import { explorerKindCategory } from '../../../utils/explorer-ui/explorerRoute';
import {
	defaultUnitsConfig,
	unitsConfigFile,
	unitsConfigSchema,
	type UnitsConfig
} from '../../../core/development-tooling/unitsConfig';
import { helperReferences } from './helperReferences';
import { serviceClasses } from './serviceClasses';
import {
	type HelperFacts,
	type HelperReference,
	type HelperBinding
} from '../../../utils/explorer-ui/helperReferences';
import { resolveImport } from '../../../utils/development-tooling/resolveImport';

async function configuration(tree: HelperTree): Promise<UnitsConfig> {
	try {
		return unitsConfigSchema.parse(JSON.parse(await tree.read(unitsConfigFile)));
	} catch {
		return defaultUnitsConfig;
	}
}

function target(from: string, binding: HelperBinding, context: Context): string | undefined {
	if (!binding.specifier) return from;
	const key = `${from}#${binding.specifier}`;
	if (!context.resolved.has(key)) context.resolved.set(key, moduleTarget(from, binding, context));
	return context.resolved.get(key);
}

function moduleTarget(from: string, binding: HelperBinding, context: Context): string | undefined {
	const declared = context.config.references.find(
		(item) => item.from === from && item.specifier === binding.specifier
	);
	if (declared) return declared.to;
	const roots = context.config.workspaces
		.map((item) => (item.root === '.' ? '' : item.root))
		.sort((a, b) => b.length - a.length);
	const workspaceRoot = roots.find((root) => !root || from.startsWith(`${root}/`)) ?? '';
	return resolveImport(
		from,
		{ specifier: binding.specifier ?? null, via: 'import', typeOnly: false },
		{ files: context.paths, workspaceRoot }
	).path;
}

async function sourceFacts(tree: HelperTree, paths: string[]) {
	const facts = new Map<string, HelperFacts>();
	for (let start = 0; start < paths.length; start += 64) {
		await Promise.all(
			paths.slice(start, start + 64).map(async (path) => {
				try {
					facts.set(path, helperReferences(await tree.read(path), path.endsWith('.svelte')));
				} catch {
					facts.set(path, { references: [], forwards: [] });
				}
			})
		);
	}
	return facts;
}

function resolveHelper(
	path: string,
	name: string,
	context: Context,
	seen = new Set<string>()
): string | undefined {
	const key = `${path}#${name}`;
	if (seen.has(key)) return undefined;
	seen.add(key);
	if (context.helpers.has(key)) return key;
	for (const binding of context.facts.get(path)?.forwards ?? []) {
		const next = forwardTarget({ path, name }, binding, context);
		if (!next) continue;
		const resolved = resolveHelper(
			next,
			binding.imported === '*' ? name : binding.imported,
			context,
			seen
		);
		if (resolved) return resolved;
	}
	return undefined;
}

function forwardTarget(
	asked: { path: string; name: string },
	binding: HelperFacts['forwards'][number],
	context: Context
) {
	if (binding.name !== '*' && binding.name !== asked.name) return undefined;
	return target(asked.path, binding, context);
}

function consumerOf(unit: Unit, reference: HelperReference): HelperConsumer | undefined {
	const category = explorerKindCategory(unit.kind);
	if (category === 'components' || category === 'services') return { unit: unit.id };
	return reference.caller ? { unit: unit.id, symbol: reference.caller } : undefined;
}

function consumerReference(path: string, reference: HelperReference, context: Context) {
	const next = target(path, reference, context);
	if (!next) return undefined;
	const key = resolveHelper(next, reference.imported, context);
	if (!key || (!reference.specifier && reference.caller === reference.imported)) return undefined;
	return key;
}

function runtimeUser(unit: Unit, path: string, reference: HelperReference, context: Context) {
	const key = consumerReference(path, reference, context);
	if (!key || context.services.get(key) === unit.id) return undefined;
	const consumer = context.services.has(key) ? { unit: unit.id } : consumerOf(unit, reference);
	return consumer ? { key, consumer } : undefined;
}

function usersOf(context: Context): Map<string, Map<string, HelperConsumer>> {
	const users = new Map<string, Map<string, HelperConsumer>>();
	for (const unit of context.units) {
		for (const path of unit.owns.source)
			for (const reference of context.facts.get(path)?.references ?? []) {
				const found = runtimeUser(unit, path, reference, context);
				if (!found) continue;
				const { key, consumer } = found;
				const identity = `${consumer.unit}#${consumer.symbol ?? ''}`;
				if (!users.has(key)) users.set(key, new Map());
				users.get(key)!.set(identity, consumer);
			}
	}
	return users;
}

/** Actual runtime references, distinct per component/service or named function, at this revision. */
export async function helperConsumers(tree: HelperTree, units: Unit[]): Promise<void> {
	const active = units.filter((unit) => unit.status === 'active');
	const owned = [...new Set(active.flatMap((unit) => unit.owns.source))].filter((path) =>
		/\.(?:[cm]?[jt]sx?|svelte)$/.test(path)
	);
	const paths = new Set(tree.list ? (await tree.list()).map((item) => item.path) : owned);
	const facts = await sourceFacts(tree, owned);
	const helpers = new Set(
		active.flatMap((unit) =>
			(unit.helpers ?? []).map((helper) => `${helper.source}#${helper.name}`)
		)
	);
	const services = new Map(
		active.flatMap((unit) =>
			(unit.serviceExports ?? []).map((item) => [`${item.source}#${item.name}`, unit.id] as const)
		)
	);
	for (const key of services.keys()) helpers.add(key);
	const context = {
		units: active,
		config: await configuration(tree),
		paths,
		facts,
		helpers,
		services,
		resolved: new Map<string, string | undefined>()
	};
	const users = usersOf(context);
	for (const unit of units)
		for (const helper of unit.helpers ?? []) {
			helper.consumers = [...(users.get(`${helper.source}#${helper.name}`)?.values() ?? [])].sort(
				(a, b) => `${a.unit}#${a.symbol ?? ''}`.localeCompare(`${b.unit}#${b.symbol ?? ''}`)
			);
		}
	attachServices(units, users);
	serviceClasses(active, facts, {
		users,
		target: (path, binding) => target(path, binding, context),
		reference: (path, reference) => consumerReference(path, reference, context)
	});
}

function attachServices(units: Unit[], users: Map<string, Map<string, HelperConsumer>>): void {
	for (const unit of units) {
		const consumers = new Map<string, HelperConsumer>();
		for (const item of unit.serviceExports ?? [])
			for (const consumer of users.get(`${item.source}#${item.name}`)?.values() ?? [])
				consumers.set(consumer.unit, { unit: consumer.unit });
		unit.serviceConsumers = [...consumers.values()].sort((a, b) => a.unit.localeCompare(b.unit));
	}
}
