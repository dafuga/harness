import {
	createPackageFromStreams,
	extractFile,
	getRawHeader,
	listPackage,
	statFile,
	type AsarStreamType,
	type AsarFileStream
} from '@electron/asar';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { Readable } from 'node:stream';

export class DesktopArchiveAdapter {
	read(source: string, paths: string[]): Map<string, string> {
		return new Map(paths.map((path) => [path, extractFile(source, path).toString()]));
	}

	async patch(source: string, target: string, changes: Map<string, string>): Promise<string> {
		if (source === target) throw new Error('Archive destination must be a separate copy');
		const paths = listPackage(source, { isPack: false }).map((path) => path.replace(/^\//u, ''));
		const streams = paths.map((path) => this.entry(source, path, changes));
		for (const [path, content] of changes) {
			if (!paths.includes(path)) streams.push(this.file(source, path, Buffer.from(content), {}));
		}
		await createPackageFromStreams(target, streams);
		return createHash('sha256').update(getRawHeader(target).headerString).digest('hex');
	}

	private entry(source: string, path: string, changes: Map<string, string>): AsarStreamType {
		const info = statFile(source, path, false);
		if ('files' in info) return { type: 'directory', path, unpacked: info.unpacked ?? false };
		if ('link' in info)
			return {
				...this.file(source, path, Buffer.alloc(0), info),
				type: 'link',
				symlink: info.link
			};
		const replacement = changes.get(path);
		const data = replacement === undefined ? extractFile(source, path) : Buffer.from(replacement);
		return this.file(source, path, data, info);
	}

	private file(
		source: string,
		path: string,
		data: Buffer,
		options: { unpacked?: boolean; executable?: boolean }
	): AsarFileStream {
		const stat = Object.assign(statSync(source), {
			size: data.length,
			mode: options.executable ? 0o755 : 0o644
		});
		return {
			type: 'file',
			path,
			unpacked: options.unpacked ?? false,
			stat,
			streamGenerator: () => Readable.from(data)
		};
	}
}
