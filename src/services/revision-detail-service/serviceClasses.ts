import type { HelperBinding, HelperFacts, HelperReference } from '../../utils/helperReferences';
import type { HelperConsumer } from '../../utils/helperConsumers';
import type { PublicServiceClass } from '../../utils/unitMetadata';
import type { RevisionRegistry } from '../../utils/revisionRegistry';

type Unit = RevisionRegistry['units'][number];
type Facts = Map<string, HelperFacts>;
type Definition = NonNullable<HelperFacts['classes']>[number] & { source: string };
interface Lookup {
	users: Map<string, Map<string, HelperConsumer>>;
	target(path: string, binding: HelperBinding): string | undefined;
	reference(path: string, reference: HelperReference): string | undefined;
}

function definition(
	asked: { source: string; name: string },
	facts: Facts,
	lookup: Lookup,
	seen = new Set<string>()
): Definition | undefined {
	const key = `${asked.source}#${asked.name}`;
	if (seen.has(key)) return undefined;
	seen.add(key);
	const file = facts.get(asked.source);
	const held = file?.classes?.find((item) => item.name === asked.name);
	return held
		? inherited({ ...held, source: asked.source }, facts, lookup, seen)
		: forwarded(asked, facts, lookup, seen);
}

function inherited(held: Definition, facts: Facts, lookup: Lookup, seen: Set<string>): Definition {
	const source = held.base && lookup.target(held.source, held.base);
	const base = source && definition({ source, name: held.base!.imported }, facts, lookup, seen);
	return { ...held, methods: [...new Set([...held.methods, ...(base ? base.methods : [])])] };
}

function forwarded(
	asked: { source: string; name: string },
	facts: Facts,
	lookup: Lookup,
	seen: Set<string>
): Definition | undefined {
	const file = facts.get(asked.source);
	for (const binding of file?.forwards ?? []) {
		if (binding.name !== '*' && binding.name !== asked.name) continue;
		const source = lookup.target(asked.source, binding);
		if (!source) continue;
		const found = definition(
			{ source, name: binding.imported === '*' ? asked.name : binding.imported },
			facts,
			lookup,
			seen
		);
		if (found) return found;
	}
	return undefined;
}

function constructors(units: Unit[], facts: Facts, lookup: Lookup) {
	const found = new Map<string, Set<string>>();
	for (const unit of units)
		for (const path of unit.owns.source)
			for (const reference of facts.get(path)?.references ?? []) {
				if (!reference.construct) continue;
				const key = lookup.reference(path, reference);
				if (!key) continue;
				if (!found.has(key)) found.set(key, new Set());
				found.get(key)!.add(unit.id);
			}
	return found;
}

function owners(users: Iterable<{ unit: string }>): HelperConsumer[] {
	return [...new Set([...users].map((user) => user.unit))].sort().map((unit) => ({ unit }));
}

interface ProofContext {
	facts: Facts;
	lookup: Lookup;
	constructed: Map<string, Set<string>>;
}

function exportClass(
	item: { source: string; name: string },
	context: ProofContext
): PublicServiceClass | undefined {
	const declared = definition(item, context.facts, context.lookup);
	if (!declared || declared.abstract) return undefined;
	const key = `${item.source}#${item.name}`;
	return {
		name: declared.name,
		source: declared.source,
		methods: declared.methods,
		consumers: owners(context.lookup.users.get(key)?.values() ?? []),
		constructedBy: [...(context.constructed.get(key) ?? [])].sort().map((unit) => ({ unit }))
	};
}

function merge(
	held: PublicServiceClass | undefined,
	entry: PublicServiceClass
): PublicServiceClass {
	return {
		...entry,
		consumers: owners([...(held?.consumers ?? []), ...entry.consumers]),
		constructedBy: owners([...(held?.constructedBy ?? []), ...entry.constructedBy])
	};
}

/** Class eligibility is declaration-level proof; runtime exports remain available for ownership. */
export function serviceClasses(units: Unit[], facts: Facts, lookup: Lookup): void {
	const context = { facts, lookup, constructed: constructors(units, facts, lookup) };
	for (const unit of units) {
		const classes = new Map<string, PublicServiceClass>();
		for (const item of unit.serviceExports ?? []) {
			const entry = exportClass(item, context);
			if (!entry || !unit.owns.source.includes(entry.source)) continue;
			const identity = `${entry.source}#${entry.name}`;
			classes.set(identity, merge(classes.get(identity), entry));
		}
		unit.serviceClasses = [...classes.values()];
	}
}
