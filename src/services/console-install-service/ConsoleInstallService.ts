import { fail } from "../../core/errors";
import { bundledSize, consoleDataModules } from "./consoleDataModules";
import { type BundledSize, type IndexFile } from "../../utils/consoleDataModules";
import { consoleHostFiles } from "./consoleHostFiles";
import { type HostFile } from "../../utils/consoleHostFiles";
import { consoleManifest, writeConsoleManifest, type ConsoleChange, type ConsoleFileEntry, type ConsoleManifest, type ConsoleStorage } from "../../utils/consoleManifest";
import { indexFiles } from "../../utils/indexFiles";
import { hostWarnings, installableHost } from "./installableHost";
import { ConsoleChangeService, type FileState } from "../ConsoleChangeService";

export interface ConsoleInstallOptions {
	host: string;
	/** Module of the host that exports the policy, written as the host imports it. */
	policy: string;
	policyExport: string;
	base: string;
	/** Output directory of `harness history build`: bundled into the server, or to be uploaded. */
	data?: string;
	/** Binding of a private object store to read the history from instead of bundling it. */
	bucket?: string;
	/** Path inside that store the index was uploaded under. */
	prefix?: string;
	/** Replace files that hold other content; what they held is saved and the change recorded. */
	update?: boolean;
	/** Leave files that hold other content as the host's own version. */
	keep?: boolean;
}

export interface ConsoleInstallResult {
	host: string;
	base: string;
	policy: string;
	written: string[];
	removed: string[];
	/** Files left as the host's own version. */
	kept: string[];
	/** Files that held other content and were replaced or removed on request. */
	changes: ConsoleChange[];
	data: { revisions: number; media: number; bytes: number } | null;
	storage: ConsoleStorage;
	/** What the bundled history adds to the server; null when nothing is bundled. */
	bundle: BundledSize | null;
	warnings: string[];
}

/** One file to write, or to remove when its contents are null, and what is in the way. */
interface Step {
	path: string;
	contents: string | null;
	state: FileState;
}

type Applied = Pick<ConsoleInstallResult, 'written' | 'removed' | 'kept' | 'changes'> & {
	entries: ConsoleFileEntry[];
};

/** Installs the console into a SvelteKit host and records exactly what it wrote and changed. */
export class ConsoleInstallService {
	async install(options: ConsoleInstallOptions): Promise<ConsoleInstallResult> {
		const { host, base } = options;
		await installableHost(options);
		const index = options.data ? await indexFiles(options.data) : [];
		const policy = { module: options.policy, export: options.policyExport };
		const storage = storageOf(options);
		// A bucket holds the history itself, so none of it becomes part of the host.
		const modules = storage.kind === 'bundle' ? consoleDataModules(index) : [];
		const manifest = await consoleManifest(host);
		const tracker = new ConsoleChangeService(host, manifest);
		const steps = await planned(tracker, wantedFiles(options, modules, manifest));
		refuseUnasked(steps, options);
		const applied = await this.apply(tracker, steps, options.update === true);
		const changes = [...manifest.changes, ...applied.changes];
		const files = applied.entries;
		await writeConsoleManifest(host, { ...manifest, base, policy, storage, files, changes });
		const bundle = bundledSize(modules);
		return {
			host,
			base,
			policy: `${policy.module}#${policy.export}`,
			written: applied.written,
			removed: applied.removed,
			kept: applied.kept,
			changes: applied.changes,
			data: options.data ? measured(index) : null,
			storage,
			bundle,
			warnings: await hostWarnings(host, bundle?.compressedBytes ?? 0)
		};
	}

	/** Puts back what the latest recorded change to `path` replaced, and records that too. */
	async restore(host: string, path: string): Promise<ConsoleChange> {
		const manifest = await consoleManifest(host);
		const tracker = new ConsoleChangeService(host, manifest);
		const change = await tracker.restore(path);
		if (!change) return fail(`No replaced contents are recorded for ${path}.`);
		// What was restored is the host's version again, so later installs leave it in place.
		const files = manifest.files.filter((file) => file.path !== path);
		files.push(await tracker.entryFor(path, 'host'));
		await writeConsoleManifest(host, {
			...manifest,
			files,
			changes: [...manifest.changes, change]
		});
		return change;
	}

	private async apply(
		tracker: ConsoleChangeService,
		steps: Step[],
		update: boolean
	): Promise<Applied> {
		const done: Applied = { written: [], removed: [], kept: [], changes: [], entries: [] };
		for (const step of steps) {
			if (held(step.state) && !update) {
				done.kept.push(step.path);
				done.entries.push(await tracker.entryFor(step.path, 'host'));
			} else await carryOut(tracker, step, done);
		}
		return done;
	}
}

/** Every file to write, then every file an earlier install wrote that is no longer wanted. */
function wantedFiles(
	options: ConsoleInstallOptions,
	modules: HostFile[],
	manifest: ConsoleManifest
): Array<{ path: string; contents: string | null }> {
	const storage = storageOf(options);
	const host = {
		base: options.base,
		policyModule: options.policy,
		policyExport: options.policyExport,
		...(storage.kind === 'bucket' ? { bucket: storage } : {})
	};
	const files = [...consoleHostFiles(host), ...modules];
	const wanted = new Set(files.map((file) => file.path));
	const stale = manifest.files
		.filter((entry) => entry.owner === 'harness' && !wanted.has(entry.path))
		.map((entry) => ({ path: entry.path, contents: null }));
	return [...files, ...stale];
}

function storageOf(options: ConsoleInstallOptions): ConsoleStorage {
	return options.bucket
		? { kind: 'bucket', binding: options.bucket, prefix: options.prefix ?? '' }
		: { kind: 'bundle' };
}

/** True when writing would overwrite content Harness did not put there. */
function held(state: FileState): state is Extract<FileState, { reason: string }> {
	return state.kind === 'kept' || state.kind === 'conflict';
}

/** Writes or removes one file; content it displaces is saved and recorded as a change first. */
async function carryOut(tracker: ConsoleChangeService, step: Step, done: Applied): Promise<void> {
	const { path, contents, state } = step;
	if (held(state)) {
		const action = contents === null ? 'removed' : 'replaced';
		done.changes.push(await tracker.replace(path, contents, { action, reason: state.reason }));
	} else if (contents !== null) await tracker.write(path, contents);
	else if (state.kind === 'unchanged') await tracker.remove(path);
	if (contents === null) {
		if (state.kind !== 'free') done.removed.push(path);
		return;
	}
	done.written.push(path);
	done.entries.push(await tracker.entryFor(path, 'harness'));
}

async function planned(
	tracker: ConsoleChangeService,
	files: Array<{ path: string; contents: string | null }>
): Promise<Step[]> {
	return Promise.all(
		files.map(async (file) => ({ ...file, state: await tracker.state(file.path, file.contents) }))
	);
}

/** Without a decision, an install that would lose content stops before it writes anything. */
function refuseUnasked(steps: Step[], options: ConsoleInstallOptions): void {
	const conflicts = steps.flatMap((step) =>
		step.state.kind === 'conflict' ? [{ path: step.path, reason: step.state.reason }] : []
	);
	if (conflicts.length === 0 || options.update || options.keep) return;
	const described = conflicts.map(({ path, reason }) => {
		const why =
			reason === 'host-owned' ? `${reason}: not written by harness console install` : reason;
		return `  ${path} (${why})`;
	});
	fail(
		[
			`${conflicts.length} files hold content this install would overwrite:`,
			...described,
			"Run again with --update to replace them; what they hold is saved in the project and the change is recorded. Or run with --keep to leave them as the host's own version."
		].join('\n')
	);
}

function measured(index: IndexFile[]): { revisions: number; media: number; bytes: number } {
	return {
		revisions: index.filter((file) => file.path.startsWith('revisions/')).length,
		media: index.filter((file) => file.path.startsWith('media/')).length,
		bytes: index.reduce((sum, file) => sum + file.bytes.length, 0)
	};
}
