// @harness-uid u_3tqecbjzkv
import { BoundedCommandAdapter } from '../../adapters/execution-runtimes/BoundedCommandAdapter';
import { basename, relative } from 'node:path';
import type { CollectedFiles } from './collect';
import type { ReviewCoverage } from './cleanCodeTypes';

const sourceExtensions = new Set([
	'.ts',
	'.tsx',
	'.js',
	'.jsx',
	'.svelte',
	'.py',
	'.c',
	'.cc',
	'.cpp',
	'.cxx',
	'.h',
	'.hh',
	'.hpp',
	'.hxx',
	'.sql',
	'.sh'
]);
const sensitiveSegments = new Set([
	'.codex',
	'.credentials',
	'.secrets',
	'.ssh',
	'vendor',
	'secrets'
]);

export function discoverCleanCodeFiles(
	root: string,
	collected: CollectedFiles,
	exclusions: string[]
): ReviewCoverage {
	const files = collected.files.map((file) => ({
		...file,
		path: relative(root, file.path).replaceAll('\\', '/')
	}));
	const ignored = gitIgnoredPaths(
		root,
		files.map((file) => file.path)
	);
	const coverage: ReviewCoverage = {
		selectedFiles: [],
		unsupportedFiles: [],
		excludedPaths: collected.ignoredPaths.map((path) => ({
			path,
			reason: 'Artifact directory or symlink'
		}))
	};
	for (const file of files.sort((left, right) => left.path.localeCompare(right.path))) {
		const reason = exclusionReason(file.path, ignored, exclusions);
		if (reason) coverage.excludedPaths.push({ path: file.path, reason });
		else if (sourceExtensions.has(file.extension)) coverage.selectedFiles.push(file.path);
		else coverage.unsupportedFiles.push(file.path);
	}
	return coverage;
}

function gitIgnoredPaths(root: string, paths: string[]): Set<string> {
	try {
		const result = new BoundedCommandAdapter().runSync(
			'git',
			['check-ignore', '--no-index', '--stdin', '-z'],
			{
				cwd: root,
				input: paths.join('\0') + '\0',
				maxBuffer: 16 * 1024 * 1024,
				timeoutMs: 3000,
				env: { GIT_TERMINAL_PROMPT: '0' }
			}
		);
		return result.code === 0
			? new Set(result.stdout.toString('utf8').split('\0').filter(Boolean))
			: new Set();
	} catch {
		return new Set();
	}
}

function exclusionReason(
	path: string,
	ignored: Set<string>,
	exclusions: string[]
): string | undefined {
	if (ignored.has(path)) return 'Git ignored';
	if (
		path.split('/').some((segment) => sensitiveSegments.has(segment)) ||
		basename(path).startsWith('.env')
	)
		return 'Sensitive or third-party path';
	if (exclusions.some((pattern) => matchesExclusion(path, pattern))) return 'Configured exclusion';
	if (/\.(generated|gen)\.[^.]+$/.test(path)) return 'Generated source';
	return undefined;
}

export function matchesExclusion(path: string, pattern: string): boolean {
	const normalized = pattern.replaceAll('\\', '/').replace(/^\.\//, '');
	if (normalized.endsWith('/')) return path.startsWith(normalized);
	const expression = normalized
		.split(/(\*\*\/|\*\*|\*|\?)/)
		.map(globSegment)
		.join('');
	return new RegExp(`^${expression}$`).test(path);
}

function globSegment(segment: string): string {
	if (segment === '**/') return '(?:.*/)?';
	if (segment === '**') return '.*';
	if (segment === '*') return '[^/]*';
	if (segment === '?') return '[^/]';
	return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
