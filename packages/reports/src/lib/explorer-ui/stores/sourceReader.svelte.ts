import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';

export interface SourceState {
	files: string[];
	path: string;
	text: string;
	loading: boolean;
	error: string;
}
export type SourceFiles = () => Promise<string[]>;
export type SourceRead = (path: string) => Promise<string>;

function sourceError(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

/** Owns one source read session; later selections and disposal supersede pending replies. */
export function createSourceReaderStore() {
	const state = $state<SourceState>({ files: [], path: '', text: '', loading: true, error: '' });
	let generation = 0;
	let read: SourceRead;
	async function select(path: string) {
		if (!state.files.includes(path)) return;
		const own = ++generation;
		Object.assign(state, { path, text: '', loading: true, error: '' });
		try {
			const text = await read(path);
			if (own === generation) state.text = text;
		} catch (cause) {
			if (own === generation) state.error = sourceError(cause);
		} finally {
			if (own === generation) state.loading = false;
		}
	}
	async function initialise(files: SourceFiles, load: SourceRead) {
		const own = ++generation;
		read = load;
		Object.assign(state, { files: [], path: '', text: '', loading: true, error: '' });
		try {
			const found = await files();
			if (own !== generation) return;
			state.files = found;
			state.loading = false;
			if (found.length) await select(found[0]);
		} catch (cause) {
			if (own !== generation) return;
			state.error = sourceError(cause);
			state.loading = false;
		}
	}
	return {
		state,
		select,
		initialise,
		cancel: () => {
			generation++;
		}
	};
}

/** Keep actual category implementations, with recorded addresses for older revisions. */
export function implementationFiles(unit: HarnessUnit): string[] {
	const archived = unit.sourceFiles;
	const source: string[] = [];
	const length = archived?.length ?? unit.owns.source.length;
	for (let position = 0; position < length; position++)
		source.push(archived ? archived[position].path : unit.owns.source[position]);
	if (!unit.group) return source;
	const categorized: string[] = [];
	for (let position = 0; position < source.length; position++) {
		const path = source[position];
		if (path.split('/').includes(unit.group.id)) categorized.push(path);
	}
	return categorized.length ? categorized : source;
}

/** Read only text archived with this revision; never substitute a working-copy file. */
export function archivedSource(unit: HarnessUnit, mediaBase: string, filePath?: string) {
	const archived = unit.sourceFiles;
	const files: SourceFiles = async () => {
		const paths = archived ? implementationFiles(unit) : [];
		return filePath && paths.includes(filePath)
			? [filePath, ...paths.filter((path) => path !== filePath)]
			: paths;
	};
	const read: SourceRead = async (path) => {
		const file = archived?.find((entry) => entry.path === path);
		if (!file?.media) throw new Error(file?.gap ?? `${path} is not archived at this revision.`);
		if (!/^media\/[a-f0-9]{64}\.txt$/.test(file.media))
			throw new Error('The recorded source reference is invalid.');
		const response = await fetch(mediaBase + file.media.slice('media/'.length));
		if (!response.ok) throw new Error(`${path} could not be read (${response.status}).`);
		return await response.text();
	};
	const empty = archived ? undefined : 'Source contents are not recorded for this revision.';
	return { files, read, empty };
}
