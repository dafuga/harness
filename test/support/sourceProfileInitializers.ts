/** Initializers share the ordinary runner fixture, including deferred callbacks. */
export const initializedModules = [
	['Map data', 'export const fields = new Map([["id", 7]]);', "fields.get('id')", '7', 2],
	['nested data', 'export const fields = { nested: { id: 7 } };', 'fields.nested.id', '7', 2],
	[
		'deferred method',
		'export const fields = { read() { return 7; } };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'nested callback',
		'export const fields = { nested: { read: () => 7 } };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'Map callback',
		'export const fields = new Map([["read", () => 7]]);',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'imported object callback',
		'import { isAbsolute } from "node:path"; export const fields = { read: isAbsolute };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'imported Map callback',
		'import { isAbsolute } from "node:path"; export const fields = new Map([["read", isAbsolute]]);',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'getter',
		'export const fields = { get read() { throw Error("not called"); } };',
		'Boolean(fields)',
		'true',
		0
	],
	[
		'nested class',
		'export const fields = { type: class { read() { return 7; } } };',
		'Boolean(fields)',
		'true',
		0
	]
] as const;
