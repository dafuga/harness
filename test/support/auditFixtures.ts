export const ruleFixtures: Record<string, string> = {
	'small-class': [
		'export class BigClass {',
		...Array.from({ length: 121 }, (_, index) => `\tvalue${index} = ${index};`),
		'}'
	].join('\n'),
	'method-length': [
		'export class BigMethod {',
		'\trun(): void {',
		...Array.from({ length: 36 }, () => '\t\tvoid 1;'),
		'\t}',
		'}'
	].join('\n'),
	'max-complexity': [
		'export function branchy(): void {',
		...Array.from({ length: 11 }, (_, index) => `\tif (${index} > -1) void ${index};`),
		'}'
	].join('\n'),
	'max-nesting':
		'export function nested(): void {\n\tif (true) {\n\t\tif (true) {\n\t\t\tif (true) {\n\t\t\t\tif (true) {\n\t\t\t\t\tif (true) {\n\t\t\t\t\t\tvoid 1;\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}\n',
	'max-parameters':
		'export function tooMany(a: string, b: string, c: string, d: string, e: string): string {\n\treturn a + b + c + d + e;\n}\n',
	'max-classes-per-file':
		"export class FirstThing {\n\tvalue = 'first';\n}\n\nexport class SecondThing {\n\tvalue = 'second';\n}\n",
	'no-manager-name':
		"export class ReportManager {\n\trun(): string {\n\t\treturn 'report';\n\t}\n}\n"
};
