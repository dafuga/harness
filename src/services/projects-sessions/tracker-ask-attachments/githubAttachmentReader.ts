// @harness-uid u_z3r4obtmpw
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { TrackerAttachmentReader } from './githubAttachmentReader.types';

const run = promisify(execFile);
const maxBuffer = 4 * 1024 * 1024;

/** Reads GitHub with the flagging computer's own `gh` sign-in; no token passes through here. */
export const githubAttachmentReader: TrackerAttachmentReader = {
	async head(repo, pr) {
		const out = await gh([`repos/${repo}/pulls/${pr}`, '--jq', '.head.sha']);
		return out.toString().trim();
	},
	file(repo, path, ref) {
		const address = path.split('/').map(encodeURIComponent).join('/');
		return gh([
			'-H',
			'Accept: application/vnd.github.raw+json',
			`repos/${repo}/contents/${address}?ref=${encodeURIComponent(ref)}`
		]);
	}
};

async function gh(args: string[]): Promise<Buffer> {
	const { stdout } = await run('gh', ['api', ...args], {
		encoding: 'buffer',
		maxBuffer,
		timeout: 30_000
	});
	return stdout;
}
