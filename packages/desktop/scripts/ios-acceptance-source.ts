import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { contents, desktopRoot, fileDigest, tool, tried } from './ios-products';

/**
 * TEST ONLY. What a native acceptance run was made from, named by content: the revision, and a
 * digest over each set of source files that one thing is built from. Other people work in the
 * same tree, so a set is read before and after what is built from it; a run on source that
 * moved meanwhile says so, and never borrows the name of a revision.
 */
const repository = resolve(desktopRoot, '../..');
const sourceRepository = sourceArguments();

/** Snapshot metadata is local scratch, backed only by the actual selected commit objects. */
function sourceArguments(): string[] {
	const metadata = process.env.HARNESS_NATIVE_SOURCE_GIT_DIR;
	if (!metadata) return ['-C', repository];
	const cache = realpathSync(resolve(repository, '.cache'));
	if (!realpathSync(metadata).startsWith(`${cache}/`))
		throw new Error('Native source metadata must stay inside this snapshot cache');
	const args = [`--git-dir=${metadata}`, `--work-tree=${repository}`];
	const read = (revision: string) => tool(['git', ...args, 'rev-parse', revision]).trim();
	if (
		read('HEAD') !== process.env.HARNESS_VERIFY_REVISION ||
		read('HEAD^{tree}') !== process.env.HARNESS_VERIFY_TREE
	)
		throw new Error('Native source metadata does not match the selected Harness commit and tree');
	return args;
}

/** What the renderer in the products is bundled from, with the versions it depends on. */
export const rendererSources = [
	'packages/desktop/src',
	'packages/desktop/package.json',
	'packages/desktop/svelte.config.js',
	'packages/desktop/vite.config.ts',
	'packages/remote/src',
	'packages/collaboration/src',
	'packages/planning/src',
	'packages/reports/src/components',
	'bun.lock'
];
/** What the native shell is built from, beside the renderer that is copied into it. */
export const nativeSources = ['packages/desktop/ios', 'packages/desktop/capacitor.config.ts'];
/** What the TEST ONLY fixture computer runs. */
export const computerSources = [
	'packages/desktop/src',
	'packages/desktop/scripts',
	'packages/remote/src',
	'packages/relay/src'
];

function git(...args: string[]): string {
	return tool(['git', ...sourceRepository, ...args]).trim();
}

/** Every file under the named paths that Git does not ignore, with the digest of its bytes. */
export function sourceFiles(paths: string[]): Map<string, string> {
	const listed = git('ls-files', '-co', '--exclude-standard', '--', ...paths).split('\n');
	const files = listed.filter((file) => file && existsSync(resolve(repository, file))).sort();
	return new Map(files.map((file) => [file, fileDigest(resolve(repository, file))]));
}

/** Every file under a folder by its path inside it, with the digest of its bytes. */
export function tree(folder: string): Map<string, string> {
	const files = existsSync(folder) ? contents(folder).sort() : [];
	return new Map(files.map((file) => [relative(folder, file), fileDigest(file)]));
}

/** One digest over a set of files: the same files with the same bytes, and nothing else. */
export function treeDigest(files: Map<string, string>): string {
	const digest = createHash('sha256');
	for (const [file, bytes] of files) digest.update(`${file}\0${bytes}\n`);
	return digest.digest('hex');
}

/** The files of the first set that the second does not hold with the same bytes. */
export function missing(from: Map<string, string>, held: Map<string, string>): string[] {
	return [...from].filter(([file, bytes]) => held.get(file) !== bytes).map(([file]) => file);
}

/** The files that two readings of one set do not agree on: changed, added or removed. */
export function moved(before: Map<string, string>, after: Map<string, string>): string[] {
	return [...new Set([...missing(before, after), ...missing(after, before)])].sort();
}

/** What a report says of one set of source files. */
export function named(files: Map<string, string>) {
	return { digest: treeDigest(files), files: files.size };
}

/** The three sets a run is made from, as they are read at one moment. */
export interface SourceReading {
	renderer: Map<string, string>;
	native: Map<string, string>;
	fixtureComputer: Map<string, string>;
}

export function readSources(): SourceReading {
	return {
		renderer: sourceFiles(rendererSources),
		native: sourceFiles(nativeSources),
		fixtureComputer: sourceFiles(computerSources)
	};
}

/** Every file that two readings do not agree on, in any of the three sets. */
export function movedSources(before: SourceReading, after: SourceReading): string[] {
	const sets = ['renderer', 'native', 'fixtureComputer'] as const;
	return [...new Set(sets.flatMap((set) => moved(before[set], after[set])))].sort();
}

/** The revision the working tree stands on, and whether the tree differs from it. */
export function revision() {
	return {
		revision: git('rev-parse', 'HEAD'),
		branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
		differsFromRevision: git('status', '--porcelain').length > 0
	};
}

/** The declared version of the inspector package, or that this workspace does not have it. */
function inspectorPackage(): string {
	const name = 'node_modules/appium-remote-debugger/package.json';
	const found = [desktopRoot, repository].map((root) => resolve(root, name)).find(existsSync);
	if (!found) return 'not installed in this workspace';
	return (JSON.parse(readFileSync(found, 'utf8')) as { version: string }).version;
}

export function toolsProof() {
	return {
		xcode: tried(['xcodebuild', '-version']).output.trim().replace(/\n/g, ', '),
		node: process.version,
		inspector: inspectorPackage()
	};
}
