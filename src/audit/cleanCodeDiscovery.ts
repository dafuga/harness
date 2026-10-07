import { spawnSync } from 'node:child_process';
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
	const result = spawnSync('git', ['check-ignore', '--no-index', '--stdin', '-z'], {
		cwd: root,
		encoding: 'utf8',
		input: paths.join('\0') + '\0',
		maxBuffer: 16 * 1024 * 1024
	});
	if (result.status !== 0) return new Set();
	return new Set(result.stdout.split('\0').filter(Boolean));
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
