// @harness-uid u_psxc3463x5
import { ExpectedCliError } from '../../development-tooling/errors';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DeployProject } from '../../../validators/execution-runtimes/DeployManifestValidator';
import { runProcess } from './runProcess';
import { sha } from './contracts';

export async function prepareDeployInputs(config: DeployProject, work: string): Promise<string> {
	const input = join(work, 'deps');
	mkdirSync(input, { mode: 0o700 });
	for (const [name, source] of Object.entries(config.inputs ?? {})) {
		await validateSource(source, source.revision);
		const target = join(input, name + '.git');
		const git = (args: string[]) =>
			runProcess('git', args, { description: 'Pinned build input ' + name });
		await git(['init', '--quiet', '--bare', target]);
		await git([
			'-C',
			target,
			'fetch',
			'--quiet',
			'--no-tags',
			'--depth=1',
			pathToFileURL(source.checkout).href,
			source.revision + ':refs/heads/deploy-input'
		]);
		await git(['-C', target, 'symbolic-ref', 'HEAD', 'refs/heads/deploy-input']);
	}
	return input;
}

export async function exportSource(
	config: DeployProject,
	source: string,
	output: string
): Promise<void> {
	await validateSource(config, source);
	await git(config, ['archive', '--format=tar', '--output=' + output, source]);
}

export async function validateSource(
	config: Pick<DeployProject, 'checkout' | 'repository' | 'sourceRef'>,
	source: string
): Promise<void> {
	const remote = (
		await git(config, ['ls-remote', '--exit-code', config.repository, config.sourceRef])
	).trim();
	const commit = sha.parse(remote.split('\t')[0]);
	if (remote.split('\t')[1] !== config.sourceRef)
		throw new ExpectedCliError('Unexpected release source branch.');
	await git(config, ['merge-base', '--is-ancestor', sha.parse(source), commit]);
}

function git(config: { checkout: string }, args: string[]): Promise<string> {
	return runProcess('git', args, {
		cwd: config.checkout,
		description: 'Release source verification'
	});
}
