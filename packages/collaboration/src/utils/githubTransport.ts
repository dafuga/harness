import { z } from "zod";
import type { GitHubOptions } from "../models/Collaboration.types";
import { fail, parse, repositorySchema, safePath, sha } from "./parseCollaborationInput";

type Request = { method?: string; body?: unknown; statuses?: number[] };

async function request(
	options: GitHubOptions,
	permission: 'read' | 'write',
	path: string,
	input: Request = {}
) {
	if ((path && !path.startsWith('/')) || path.split('/').includes('..'))
		return fail('invalid-path');
	try {
		const token = await options.token({
			installationId: options.repository.installationId,
			repositoryIds: [options.repository.id],
			permissions: { contents: permission }
		});
		const url = `https://api.github.com/repos/${options.repository.owner}/${options.repository.name}${path}`;
		const response = await (options.fetch ?? fetch)(url, requestOptions(token, input));
		return await readResponse(response, input);
	} catch {
		return fail('github-unavailable');
	}
}

async function readResponse(response: Response, input: Request) {
	if (response.status >= 300 && response.status < 400) return unavailable(response);
	if (input.statuses?.includes(response.status))
		return { status: response.status, data: null, hasNext: false };
	if (!response.ok) return unavailable(response);
	return {
		status: response.status,
		data: (await response.json()) as unknown,
		hasNext: hasNextPage(response)
	};
}

function hasNextPage(response: Response): boolean {
	return /rel="next"/.test(response.headers.get('link') ?? '');
}

function requestOptions(token: string, input: Request): RequestInit {
	return {
		method: input.method ?? 'GET',
		redirect: 'manual',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		...(input.body === undefined ? {} : { body: JSON.stringify(input.body) })
	};
}

export function githubTransport(options: GitHubOptions, permission: 'read' | 'write') {
	const repository = parse(repositorySchema, options.repository);
	return {
		request: (path: string, input?: Request) => request(options, permission, path, input),
		async check(privateOnly = false) {
			const data = parse(
				z.object({ id: z.number(), private: z.boolean() }),
				(await request(options, permission, '')).data
			);
			if (data.id !== repository.id || (privateOnly && !data.private)) fail('repository-denied');
		}
	};
}

export type GitHubTransport = ReturnType<typeof githubTransport>;

export function refPath(ref: string): string {
	if (!/^refs\/(heads|notes|tags)\/.+/.test(ref)) return fail('invalid-ref');
	safePath(ref);
	if (/\s|\.\.|@\{|[~^:?*[\\]|\.lock(?:\/|$)/.test(ref)) return fail('invalid-ref');
	return ref.slice(5).split('/').map(encodeURIComponent).join('/');
}

const reference = z.object({ ref: z.string(), object: z.object({ sha }) });

export async function readRef(client: GitHubTransport, ref: string): Promise<string | null> {
	const path = refPath(ref);
	const notes = ref.startsWith('refs/notes/');
	const endpoint = notes ? 'matching-refs' : 'ref';
	const response = await client.request(`/git/${endpoint}/${path}`, { statuses: [404] });
	if (response.status === 404) return null;
	const values = notes
		? parse(z.array(reference), response.data)
		: [parse(reference, response.data)];
	if (notes && !values.length) return null;
	const matched = values.filter((value) => value.ref === ref);
	if (matched.length !== 1) return fail('ref-mismatch');
	return matched[0].object.sha;
}

export function base64(bytes: Uint8Array): string {
	let value = '';
	for (const byte of bytes) value += String.fromCharCode(byte);
	return btoa(value);
}

export function decode64(value: string): Uint8Array {
	try {
		return Uint8Array.from(atob(value.replace(/\s/g, '')), (char) => char.charCodeAt(0));
	} catch {
		return fail('invalid-content');
	}
}

async function unavailable(response: Response): Promise<never> {
	await response.body?.cancel();
	return fail('github-unavailable');
}

export { exactRef } from './create-git-hub-source/githubTransport';
