// @harness-uid u_wwerrde2nk
import { fail } from '../../../core/development-tooling/errors';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { attackSurfacePath, securityClassesPath } from './securityReviewSchemas';

const starter = `# Attack surface

## Entry points

List the HTTP routes, webhooks, CLI inputs, files, and background jobs that receive external input.

## Trust boundaries and controls

Describe roles, tenant boundaries, authorization, signature checks, and which shared modules enforce them.

## Data and destinations

Describe data classes, where they are stored, and where logs, exports, and integrations send them.
Use names and source paths. Keep credentials, personal data, and production identifiers out of this file.

## Review scope

Name the relevant source paths, generated or delegated areas, and any known coverage gaps.
`;

const classes = {
	schemaVersion: 1,
	classes: [
		{
			id: 'sensitive-data-in-logs',
			title: 'Sensitive data in logs',
			cause:
				'Diagnostic output receives sensitive fields without the repository’s redaction control.',
			criteria:
				'Check the source of the logged values and the applicable allowlist or redaction. Dismiss public values and confirmed redaction.',
			patterns: [
				{ kind: 'call', value: 'console.log', weight: 2 },
				{ kind: 'call', value: 'logger.info', weight: 3 },
				{ kind: 'call', value: 'logger.error', weight: 3 }
			],
			contextTerms: ['redact', 'headers', 'request'],
			pathHints: []
		}
	]
};

export async function initSecurityReview(root: string) {
	const directory = dirname(securityClassesPath);
	const repository = await realpath(root);
	const specification = join(repository, dirname(directory));
	await mkdir(specification, { recursive: true });
	if ((await realpath(specification)) !== specification)
		fail('The specification directory must be inside the repository.');
	const output = join(repository, directory);
	await mkdir(output, { recursive: true });
	if ((await realpath(output)) !== output)
		fail('The security directory must be inside the repository.');
	return {
		attackSurface: await writeStarter(repository, attackSurfacePath, starter),
		bugClasses: await writeStarter(
			repository,
			securityClassesPath,
			JSON.stringify(classes, null, '\t') + '\n'
		)
	};
}

async function writeStarter(root: string, path: string, text: string) {
	try {
		await writeFile(join(root, path), text, { flag: 'wx' });
		return { path, created: true };
	} catch (error) {
		if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
		return { path, created: false };
	}
}
