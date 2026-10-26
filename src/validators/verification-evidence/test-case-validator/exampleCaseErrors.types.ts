export type AuthoredExampleField = 'input' | 'call' | 'expected';

export interface ExampleReference {
	subject: string;
	name: string;
	read: (field: AuthoredExampleField) => unknown;
}
