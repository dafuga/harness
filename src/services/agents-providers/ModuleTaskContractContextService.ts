import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { requireModuleData } from '../git-source-history/module-data-service/moduleDataAdmission';
import type { ModuleData } from '../git-source-history/ModuleDataService.types';
import type {
	ModuleTask,
	TaskRunScope
} from '../../repositories/agents-providers/ModuleTaskRepository.types';
import type {
	ModuleTaskContractContext,
	ModuleTaskContractSnapshot
} from './ModuleTaskContractContextService.types';

function pathsOverlap(left: string, right: string): boolean {
	const contains = (parent: string, target: string): boolean => {
		const path = relative(parent, target);
		return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
	};
	return contains(left, right) || contains(right, left);
}
function assertOutside(path: string, protectedPaths: string[]): void {
	if (protectedPaths.some((protectedPath) => pathsOverlap(path, protectedPath)))
		throw new Error('The contract context cannot be isolated from protected paths.');
}
function hasCode(error: unknown, code: string): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
async function commonDirectory(gitDirectory: string): Promise<string> {
	try {
		const path = (await readFile(join(gitDirectory, 'commondir'), 'utf8')).trim();
		if (!path) throw new Error('Empty Git common directory.');
		return await realpath(resolve(gitDirectory, path));
	} catch (error) {
		if (hasCode(error, 'ENOENT')) return gitDirectory;
		throw new Error('The repository Git directory could not be resolved.');
	}
}
async function commonGitDirectory(root: string): Promise<string> {
	const marker = join(root, '.git');
	const info = await stat(marker);
	if (info.isDirectory()) return commonDirectory(await realpath(marker));
	if (!info.isFile()) throw new Error('The repository Git directory could not be resolved.');
	const match = /^gitdir:\s*(.+)$/i.exec((await readFile(marker, 'utf8')).trim());
	if (!match) throw new Error('The repository Git directory could not be resolved.');
	return commonDirectory(await realpath(resolve(root, match[1])));
}
function validateFiles(files: string[]): void {
	const invalid =
		!Array.isArray(files) ||
		!files.length ||
		new Set(files).size !== files.length ||
		files.some(
			(file) =>
				typeof file !== 'string' ||
				!file ||
				file === '.' ||
				file === '..' ||
				file.startsWith(`..${sep}`) ||
				file.endsWith(sep) ||
				file.includes('\\') ||
				file.includes('\0') ||
				isAbsolute(file) ||
				normalize(file) !== file
		);
	if (invalid) throw new Error('The file grant must contain unique canonical relative paths.');
}
function privateCliReader(snapshotPath: string, seal: string): string {
	return `const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const snapshotPath = ${JSON.stringify(snapshotPath)};
const seal = ${JSON.stringify(seal)};
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = () => { throw new Error("unavailable"); };
function load() {
  const parent = fs.lstatSync(path.dirname(snapshotPath));
  const info = fs.lstatSync(snapshotPath);
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o222) !== 0) fail();
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o222) !== 0) fail();
  const raw = fs.readFileSync(snapshotPath, "utf8");
  if (crypto.createHash("sha256").update(raw, "utf8").digest("hex") !== seal) fail();
  const data = JSON.parse(raw);
  if (!object(data) || typeof data.sourceCommit !== "string" || !Array.isArray(data.declarations) || !object(data.versions) || !object(data.relationships)) fail();
  return data;
}
`;
}
function privateCliCommands(): string {
	return `function manifestFor(data, id) {
  return data.declarations.find((entry) => object(entry) && entry.id === id);
}
function dependencies(data, manifest) {
  const rows = Array.isArray(manifest.dependencies) ? manifest.dependencies : [];
  return rows.map((row) => {
    const id = typeof row === "string" ? row : object(row) ? row.unit || row.id : null;
    const target = typeof id === "string" && manifestFor(data, id);
    if (!target || !object(target.contract)) fail();
    return { id, via: "contract", contract: target.contract };
  });
}
function run() {
  const data = load();
  const args = process.argv.slice(2);
  let output;
  if (args.length === 3 && args[0] === "units" && args[1] === "list" && args[2] === "--json") {
    const units = data.declarations.map((entry) => {
      if (!object(entry) || typeof entry.id !== "string" || typeof entry.kind !== "string") fail();
      return { id: entry.id, kind: entry.kind, ...(typeof entry.responsibility === "string" ? { responsibility: entry.responsibility } : {}) };
    });
    output = { sourceCommit: data.sourceCommit, units };
  } else if (args.length === 4 && args[0] === "units" && args[1] === "show" && args[3] === "--json") {
    const manifest = manifestFor(data, args[2]);
    const version = data.versions[args[2]];
    if (!manifest || !object(manifest.contract) || !version) fail();
    output = { sourceCommit: data.sourceCommit, manifest, version, dependencies: dependencies(data, manifest) };
    if (object(data.relationships[args[2]])) output.relationships = data.relationships[args[2]];
  } else if (args.length === 4 && args[0] === "api" && args[1] === "contracts" && args[2] === "get") {
    const manifest = manifestFor(data, args[3]);
    if (!manifest || !object(manifest.contract)) fail();
    output = { sourceCommit: data.sourceCommit, unitId: args[3], contract: manifest.contract, dependencies: dependencies(data, manifest) };
  } else fail();
  process.stdout.write(JSON.stringify(output, null, 2) + "\\n");
}
try { run(); } catch { process.stderr.write("Harness contract snapshot integrity check failed or the request is invalid.\\n"); process.exitCode = 1; }
`;
}
function privateCli(snapshotPath: string, seal: string, runtimePath: string): string {
	const bunConfig = process.versions.bun && join(dirname(snapshotPath), 'bin/bunfig.toml');
	return `#!${runtimePath}${bunConfig ? ` --config=${bunConfig}` : ''}
${privateCliReader(snapshotPath, seal)}${privateCliCommands()}`;
}

async function removeContext(root: string): Promise<void> {
	for (const path of [join(root, 'bin'), root]) {
		try {
			await chmod(path, 0o700);
		} catch {
			// Removal still runs if the context was only partially created.
		}
	}
	await rm(root, { recursive: true, force: true });
}
async function createContext(
	root: string,
	task: ModuleTask,
	files: string[],
	options: { data: ModuleData; protectedPaths: string[]; runtimePath: string }
): Promise<ModuleTaskContractContext> {
	const { data, protectedPaths, runtimePath } = options;
	const contextRoot = await realpath(root);
	assertOutside(contextRoot, [...protectedPaths, runtimePath]);
	const snapshot = join(contextRoot, 'snapshot.json');
	const binDirectory = join(contextRoot, 'bin');
	const scratch = join(contextRoot, 'scratch');
	await mkdir(binDirectory, { mode: 0o700 });
	await mkdir(scratch, { mode: 0o700 });
	if (process.versions.bun) await writeFile(join(binDirectory, 'bunfig.toml'), '', { mode: 0o444 });
	const contents = JSON.stringify({
		sourceCommit: task.sourceCommit,
		declarations: data.declarations,
		versions: data.versions,
		relationships: data.relationships
	} satisfies ModuleTaskContractSnapshot);
	const seal = createHash('sha256').update(contents, 'utf8').digest('hex');
	const executable = join(binDirectory, 'harness');
	await writeFile(snapshot, contents, { encoding: 'utf8', mode: 0o600 });
	await writeFile(executable, privateCli(snapshot, seal, runtimePath), {
		encoding: 'utf8',
		mode: 0o700
	});
	await chmod(snapshot, 0o444);
	await chmod(executable, 0o555);
	await chmod(binDirectory, 0o555);
	await chmod(contextRoot, 0o555);
	const scope: TaskRunScope = {
		files: [...files],
		snapshot,
		scratch,
		readPaths: [runtimePath, binDirectory],
		protectedPaths,
		binDirectory
	};
	return { scope, binDirectory, cleanup: () => removeContext(contextRoot) };
}

export class ModuleTaskContractContextService {
	constructor(private readonly root: string) {}

	async create(
		task: ModuleTask,
		worktree: string,
		files: string[]
	): Promise<ModuleTaskContractContext> {
		if (!/^[0-9a-f]{40}$/.test(task.sourceCommit))
			throw new Error('A committed source revision is required.');
		validateFiles(files);
		const data = await requireModuleData(this.root, task.sourceCommit);
		if (!data.declarations.some(({ id }) => id === task.module.id))
			throw new Error('The assigned module is absent from committed declarations.');
		const root = await realpath(this.root);
		if (!isAbsolute(worktree)) throw new Error('An absolute isolated worktree is required.');
		const worktreeRoot = await realpath(worktree);
		if (!(await stat(worktreeRoot)).isDirectory() || pathsOverlap(root, worktreeRoot)) {
			throw new Error('The worker worktree must be isolated from the repository root.');
		}
		const protectedPaths = [...new Set([root, await commonGitDirectory(root), worktreeRoot])];
		const runtimePath = await realpath(process.execPath);
		assertOutside(runtimePath, protectedPaths);
		const contextRoot = await mkdtemp(join(tmpdir(), 'harness-contract-context-'));
		try {
			return await createContext(contextRoot, task, files, { data, protectedPaths, runtimePath });
		} catch (error) {
			await removeContext(contextRoot);
			throw error;
		}
	}
}
