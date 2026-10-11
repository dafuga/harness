import type { ConsoleData } from './consoleAccess';

/** One stored object; R2 objects have this shape. */
export interface ConsoleObject {
	text(): Promise<string>;
	arrayBuffer(): Promise<ArrayBuffer>;
}

/** The part of a private object store the console reads; an R2 bucket binding satisfies it. */
export interface ConsoleBucket {
	get(key: string): Promise<ConsoleObject | null>;
}

const types: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	wav: 'audio/wav',
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	ogg: 'audio/ogg',
	mp4: 'video/mp4',
	webm: 'video/webm'
};

/**
 * Console data kept in a private object store instead of the server bundle: the files of a
 * history index under one prefix, with media beside them. A binding has no public address, so
 * the only way to these objects is the guarded handlers of `consoleAccess`. The type of a media
 * file comes from its extension, never from what was stored with it.
 */
export function consoleStore(bucket: ConsoleBucket, prefix = ''): ConsoleData {
	const key = (path: string) => (prefix ? `${prefix.replace(/\/+$/, '')}/${path}` : path);
	return {
		async json(path) {
			return (await bucket.get(key(path)))?.text();
		},
		async media(name) {
			const found = await bucket.get(key(`media/${name}`));
			if (!found) return undefined;
			const extension = name.slice(name.lastIndexOf('.') + 1);
			return {
				bytes: new Uint8Array(await found.arrayBuffer()),
				type: types[extension] ?? 'application/octet-stream'
			};
		}
	};
}
