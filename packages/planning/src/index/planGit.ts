import { Git } from '../utils/planGit';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import { fail } from '../utils/planData';

export async function planGit(root: string): Promise<Git> {
	const canonical = await realpath(root);
	const run: Git['run'] = (args, input, env) =>
		new Promise((resolve, reject) => {
			const child = spawn('git', args, {
				cwd: canonical,
				env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env },
				stdio: 'pipe'
			});
			const out: Buffer[] = [];
			const errors: Buffer[] = [];
			child.stdout.on('data', (data) => out.push(data));
			child.stderr.on('data', (data) => errors.push(data));
			child.on('error', reject);
			child.on('close', (code) =>
				code === 0
					? resolve(Buffer.concat(out))
					: reject(
							Object.assign(
								new Error(Buffer.concat(errors).toString().trim() || 'Git command failed'),
								{ code: 'git-failed' }
							)
						)
			);
			child.stdin.on('error', () => {});
			child.stdin.end(input);
		});
	const top = (await run(['rev-parse', '--show-toplevel'])).toString().trim();
	if (top !== canonical) fail('not-a-repository', 'Select the repository root');
	const dir = (await run(['rev-parse', '--absolute-git-dir'])).toString().trim();
	return { root: canonical, dir, run, ...(await objectFormat(run)) };
}

/** The format the repository names its objects in, when Git states one known here. */
async function objectFormat(run: Git['run']): Promise<Pick<Git, 'objectFormat'>> {
	const stated = await run(['rev-parse', '--show-object-format']).then(
		(bytes) => bytes.toString().trim(),
		() => ''
	);
	return stated === 'sha1' || stated === 'sha256' ? { objectFormat: stated } : {};
}
