/** Whether a name is declared under a member: `Class.method.name`, or `Class.method` itself. */
export const within = (name: string, owner: string, whole: boolean): boolean =>
	name.startsWith(`${owner}.`) || (whole && name === owner);

/** The method a name declares on its class, and what it names under that method. */
function memberOf(name: string, owner: string): { method: string; rest: string } | undefined {
	if (!name.startsWith(`${owner}.`)) return undefined;
	const [method, ...rest] = name.slice(owner.length + 1).split('.');
	return method ? { method, rest: rest.join('.') } : undefined;
}

/** The methods of a class that names declare: `Class.method` itself, or a name under it. */
export const methodsNamed = (names: string[], owner: string, whole: boolean): string[] =>
	names.flatMap((name) => {
		const found = memberOf(name, owner);
		return found && (whole || found.rest) ? [found.method] : [];
	});

/** CRUD first, then construction and other methods; preserve order within each group. */
export const orderedMethods = (methods: string[]): string[] => {
	const priority = new Map([
		['create', 0],
		['read', 1],
		['find', 1],
		['findBy', 1],
		['update', 2],
		['delete', 3],
		['constructor', 4]
	]);
	return [...new Set(methods)].sort(
		(left, right) => (priority.get(left) ?? 5) - (priority.get(right) ?? 5)
	);
};
