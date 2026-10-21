export interface SourceState {
	files: string[];
	path: string;
	text: string;
	loading: boolean;
	error: string;
}
export type SourceFiles = () => Promise<string[]>;
export type SourceRead = (path: string) => Promise<string>;

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
			if (own === generation) state.error = cause instanceof Error ? cause.message : String(cause);
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
			state.error = cause instanceof Error ? cause.message : String(cause);
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
