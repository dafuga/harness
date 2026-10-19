import { z } from 'zod';
import type { GitHubOptions } from '../models/Collaboration.types';
import { digest, fail, hash, parse } from './parseCollaborationInput';
import { base64 } from './githubTransport';
const batchSchema = z.object({
	objects: z
		.array(
			z.object({
				oid: hash,
				size: z.number(),
				actions: z.object({
					download: z.object({ href: z.url(), header: z.record(z.string(), z.string()).optional() })
				})
			})
		)
		.length(1)
});
function pointer(bytes: Uint8Array) {
	const text = new TextDecoder().decode(bytes);
	if (!text.startsWith('version https://git-lfs.github.com/spec/')) return null;
	const match =
		/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (0|[1-9]\d*)\n?$/.exec(
			text
		);
	if (!match) return fail('invalid-lfs-pointer');
	const size = Number(match[2]);
	if (!Number.isSafeInteger(size) || size > 50_000_000) return fail('lfs-size-limit');
	return { oid: match[1], size };
}
async function downloadAction(options: GitHubOptions, object: { oid: string; size: number }) {
	const token = await options.token({
		installationId: options.repository.installationId,
		repositoryIds: [options.repository.id],
		permissions: { contents: 'read' }
	});
	const response = await (options.fetch ?? fetch)(
		`https://github.com/${options.repository.owner}/${options.repository.name}.git/info/lfs/objects/batch`,
		{
			method: 'POST',
			redirect: 'manual',
			headers: {
				Authorization: `Basic ${base64(new TextEncoder().encode(`x-access-token:${token}`))}`,
				'Content-Type': 'application/vnd.git-lfs+json',
				Accept: 'application/vnd.git-lfs+json'
			},
			body: JSON.stringify({ operation: 'download', transfers: ['basic'], objects: [object] })
		}
	);
	if (!response.ok) return await unavailable(response);
	const result = parse(batchSchema, await response.json()).objects[0];
	if (result.oid !== object.oid || result.size !== object.size) return fail('lfs-integrity');
	const action = result.actions.download;
	const url = new URL(action.href);
	if (url.protocol !== 'https:' || url.username || url.password || url.port)
		return fail('lfs-location-denied');
	if (!/(?:^|\.)(?:githubusercontent\.com|github-cloud\.s3\.amazonaws\.com)$/.test(url.hostname))
		return fail('lfs-location-denied');
	return action;
}
export async function githubLfs(options: GitHubOptions, bytes: Uint8Array): Promise<Uint8Array> {
	const object = pointer(bytes);
	if (!object) return bytes;
	try {
		const action = await downloadAction(options, object);
		const response = await (options.fetch ?? fetch)(action.href, {
			headers: action.header,
			redirect: 'manual'
		});
		if (!response.ok) return await unavailable(response);
		const result = new Uint8Array(await response.arrayBuffer());
		if (result.length !== object.size || (await digest(result)) !== object.oid)
			return fail('lfs-integrity');
		return result;
	} catch {
		return fail('lfs-unavailable');
	}
}

async function unavailable(response: Response): Promise<never> {
	await response.body?.cancel();
	return fail('lfs-unavailable');
}
