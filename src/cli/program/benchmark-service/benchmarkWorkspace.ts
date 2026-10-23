import { chmod, cp, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { benchmarkProcess } from './benchmarkProcess';

export async function benchmarkGit(cwd: string, args: string[]): Promise<string> {
	const result = await benchmarkProcess({
		command: ['git', '-c', 'core.hooksPath=/dev/null', ...args],
		cwd
	});
	if (result.exitCode)
		throw new Error('Benchmark Git operation failed. Verify the project and revision.');
	return result.stdout;
}
export async function benchmarkFiles(project: string, revision: string): Promise<string[]> {
	const tree = await benchmarkGit(project, ['ls-tree', '-r', '-z', revision]);
	const entries = tree.split('\0').filter(Boolean);
	if (
		entries.some((entry) => !entry.startsWith('100644 blob ') && !entry.startsWith('100755 blob '))
	)
		throw new Error('Benchmark snapshots do not support symlinks or submodules.');
	return entries.map((entry) => entry.slice(entry.indexOf('\t') + 1));
}
export async function snapshotBenchmark(
	project: string,
	revision: string,
	destination: string
): Promise<string[]> {
	const files = await benchmarkFiles(project, revision);
	await mkdir(destination, { recursive: true, mode: 0o700 });
	const archive = join(dirname(destination), 'snapshot.tar');
	await benchmarkGit(project, ['archive', '--format=tar', `--output=${archive}`, revision]);
	const result = await benchmarkProcess({
		command: ['tar', '-xf', archive, '-C', destination],
		cwd: project
	});
	if (result.exitCode) throw new Error('Could not extract benchmark snapshot.');
	for (const file of files) {
		if (!(await regularBenchmarkFile(destination, file)))
			throw new Error('Snapshot files are missing; export-ignore archives are unsupported.');
	}
	await rm(archive);
	return files;
}
export async function createBenchmarkWorkspace(
	baseline: string,
	destination: string
): Promise<void> {
	await rm(destination, { recursive: true, force: true });
	await cp(baseline, destination, { recursive: true });
	await benchmarkGit(destination, ['init', '-q']);
	await benchmarkGit(destination, ['add', '-f', '.']);
	await benchmarkGit(destination, [
		'-c',
		'user.name=Harness',
		'-c',
		'user.email=harness@localhost',
		'commit',
		'--allow-empty',
		'-qm',
		'benchmark baseline'
	]);
}
export async function regularBenchmarkFile(root: string, file: string): Promise<boolean> {
	let path = root;
	for (const part of file.split('/')) {
		path = join(path, part);
		const stat = await lstat(path).catch(() => undefined);
		if (!stat || stat.isSymbolicLink()) return false;
	}
	return (await lstat(path)).isFile();
}
export async function benchmarkFileValue(root: string, file: string): Promise<string | undefined> {
	if (!(await regularBenchmarkFile(root, file))) return undefined;
	const stat = await lstat(join(root, file));
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(join(root, file))) hash.update(chunk);
	return `${stat.mode & 0o111}:${hash.digest('hex')}`;
}
export async function overlayBenchmarkFiles(
	source: string,
	target: string,
	files: string[]
): Promise<void> {
	for (const file of files) {
		const destination = join(target, file);
		if (!(await regularBenchmarkFile(source, file))) {
			await rm(destination, { force: true });
			continue;
		}
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, await readFile(join(source, file)), {
			mode: (await lstat(join(source, file))).mode
		});
		await chmod(destination, (await lstat(join(source, file))).mode & 0o777);
	}
}
