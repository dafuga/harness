import { z } from "zod";
import type { GitHubOptions, SourceEntry } from "../../models/Collaboration.types.ts";
import { digest, fail, parse, sha } from "../parseCollaborationInput";

const LIMIT = 16 * 1024 * 1024;

const blob = z.object({
	__typename: z.literal('Blob'),
	oid: sha,
	text: z.string(),
	isBinary: z.literal(false),
	isTruncated: z.literal(false),
	byteSize: z.number().int().nonnegative()
});

function payload(options: GitHubOptions, input: { commit: string; entries: SourceEntry[] }) {
	const variables: Record<string, string> = {
		owner: options.repository.owner,
		name: options.repository.name
	};
	const declarations = ['$owner:String!', '$name:String!'];
	const fields = ['databaseId'];
	input.entries.forEach((entry, index) => {
		declarations.push(`$p${index}:String!`);
		variables[`p${index}`] = `${input.commit}:${entry.path}`;
		fields.push(
			`b${index}:object(expression:$p${index}){__typename ... on Blob{oid text isBinary isTruncated byteSize}}`
		);
	});
	return {
		query: `query(${declarations.join(',')}){repository(owner:$owner,name:$name){${fields.join(' ')}}}`,
		variables
	};
}

async function boundedJson(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) return fail('github-unavailable');
	const decoder = new TextDecoder('utf-8', { fatal: true });
	let size = 0,
		text = '';
	try {
		for (;;) {
			const result = await reader.read();
			if (result.done) break;
			size += result.value.length;
			if (size >= LIMIT) return fail('github-unavailable');
			text += decoder.decode(result.value, { stream: true });
		}
		return JSON.parse(text + decoder.decode()) as unknown;
	} finally {
		await reader.cancel();
	}
}

async function read(options: GitHubOptions, input: { commit: string; entries: SourceEntry[] }) {
	const token = await options.token({
		installationId: options.repository.installationId,
		repositoryIds: [options.repository.id],
		permissions: { contents: 'read' }
	});
	const response = await (options.fetch ?? fetch)('https://api.github.com/graphql', {
		method: 'POST',
		redirect: 'manual',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/vnd.github+json'
		},
		body: JSON.stringify(payload(options, input))
	});
	if (!response.ok) {
		await response.body?.cancel();
		return fail('github-unavailable');
	}
	const envelope = parse(
		z.object({
			data: z.object({ repository: z.record(z.string(), z.unknown()) }),
			errors: z.array(z.unknown()).max(0).optional()
		}),
		await boundedJson(response)
	);
	if (envelope.data.repository.databaseId !== options.repository.id)
		return fail('repository-denied');
	return envelope.data.repository;
}

async function attest(value: unknown, entry: SourceEntry) {
	const item = parse(blob, value),
		bytes = new TextEncoder().encode(item.text);
	if (item.oid !== entry.sha || item.byteSize !== bytes.length) return fail('blob-integrity');
	if (entry.size !== undefined && entry.size !== bytes.length) return fail('blob-integrity');
	const header = new TextEncoder().encode(`blob ${bytes.length}\0`),
		content = new Uint8Array(header.length + bytes.length);
	content.set(header);
	content.set(bytes, header.length);
	if ((await digest(content, 'SHA-1')) !== entry.sha) return fail('blob-integrity');
	return bytes;
}

/** One bounded batch. Caller supplies exact tree-attested metadata paths. */
export async function githubGraphql(
	options: GitHubOptions,
	input: { commit: string; entries: SourceEntry[] }
): Promise<Map<string, Uint8Array>> {
	try {
		if (input.entries.length < 1 || input.entries.length > 64) return fail('invalid-input');
		const repository = await read(options, input),
			result = new Map<string, Uint8Array>();
		for (const [index, entry] of input.entries.entries())
			result.set(entry.path, await attest(repository[`b${index}`], entry));
		return result;
	} catch {
		return fail('github-unavailable');
	}
}
