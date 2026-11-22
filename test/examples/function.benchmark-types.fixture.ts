import type { Parser, ExampleCase } from './function.benchmark-types.test.types';
import { z } from 'zod';

/** Parses each input as a caller does; a refusal is kept as the reasons the schema gives. */
export function parsing(schema: Parser) {
	return (name: string, input: unknown): ExampleCase => {
		try {
			return { name, input, output: schema.parse(input) };
		} catch (error) {
			return { name, input, error: reasons(error) };
		}
	};
}

/** The path and message of each refusal, in the order zod gives them; the root is named record. */
function reasons(error: unknown): string[] {
	if (!(error instanceof z.ZodError)) throw error;
	return error.issues.map((issue) => {
		const where = issue.path.length > 0 ? issue.path.join('.') : 'record';
		return `${where}: ${issue.message}`;
	});
}
