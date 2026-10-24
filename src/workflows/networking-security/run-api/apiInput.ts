import { readFile } from 'node:fs/promises';
import { fail } from '../../../core/development-tooling/errors';

export async function apiInput(input?: string): Promise<Record<string, unknown>> {
	if (input === undefined) return {};
	let text = input;
	if (input.startsWith('@')) text = await readFile(input.slice(1), 'utf8');
	if (input === '-') {
		if (process.stdin.isTTY) fail('Pipe a JSON body into stdin when using --input -.');
		const chunks: Buffer[] = [];
		for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
		text = Buffer.concat(chunks).toString('utf8');
	}
	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return fail('API input must be valid JSON.');
	}
	if (!body || typeof body !== 'object' || Array.isArray(body))
		fail('API input must be a JSON object.');
	return body as Record<string, unknown>;
}

export function apiQuery(fields: string[] = []): Array<[string, string]> {
	return fields.map((field) => {
		const separator = field.indexOf('=');
		if (separator < 1) fail('Each query field must use name=value.');
		return [field.slice(0, separator), field.slice(separator + 1)];
	});
}
