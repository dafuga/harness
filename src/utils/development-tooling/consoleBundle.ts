import type { ConsoleData } from '../explorer-ui/consoleAccess';

type Loader = () => Promise<unknown>;

export interface ConsoleModules {
	/** Loaders of modules whose default export is the JSON text of one data file. */
	json: Record<string, Loader>;
	/** Loaders of modules whose default export is base64 media and whose `type` is its MIME type. */
	media: Record<string, Loader>;
}

const field = (module: unknown, name: string): unknown =>
	(module as Record<string, unknown> | undefined)?.[name];

/**
 * Console data that is part of the server bundle. Each file is a module loaded only when it is
 * asked for, and only server code can import it, so the data has no public path at all: it
 * exists neither as a static asset nor in anything sent to a browser. This is what a host on
 * Workers uses, where there is no file system to read at run time.
 */
export function consoleBundle(modules: ConsoleModules): ConsoleData {
	const find = (loaders: Record<string, Loader>, name: string): Loader | undefined => {
		const key = Object.keys(loaders).find((path) => path.endsWith(`/${name}.ts`));
		return key ? loaders[key] : undefined;
	};
	return {
		async json(path) {
			const text = field(await find(modules.json, path)?.(), 'default');
			return typeof text === 'string' ? text : undefined;
		},
		async media(name) {
			const module = await find(modules.media, name)?.();
			const [encoded, type] = [field(module, 'default'), field(module, 'type')];
			if (typeof encoded !== 'string' || typeof type !== 'string') return undefined;
			const binary = atob(encoded);
			const bytes = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index += 1)
				bytes[index] = binary.charCodeAt(index);
			return { bytes, type };
		}
	};
}
