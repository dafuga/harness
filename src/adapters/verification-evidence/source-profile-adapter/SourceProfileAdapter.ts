import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import { instrumentSource } from './instrumentSource';
import type { SourceProfileAdapterConfig } from './SourceProfileAdapter.types';
export type { SourceProfileAdapterConfig } from './SourceProfileAdapter.types';

/** Internal runner adapter; it never rewrites files or participates in production builds. */
export class SourceProfileAdapter {
	private readonly owners = new Map<string, ComponentManifest[]>();

	constructor(private readonly config: SourceProfileAdapterConfig) {
		for (const unit of config.units.filter(eligibleUnit)) {
			for (const source of unit.owns.source) {
				const path = sourcePath(resolve(config.root, source));
				if (path) this.owners.set(path, [...(this.owners.get(path) ?? []), unit]);
			}
		}
	}

	transform(source: string, id: string): string | null {
		const path = sourcePath(id);
		const owners = path ? this.owners.get(path) : undefined;
		if (!path || owners?.length !== 1 || !insideRoot(this.config.root, path)) return null;
		if (!/\.(?:[cm]?ts|[cm]?js|tsx|jsx)$/.test(path) || /\.(?:cts|cjs)$/.test(path)) return null;
		return instrumentSource(source, path, owners[0]);
	}
}

function eligibleUnit(unit: ComponentManifest): boolean {
	return (
		unit.status === 'active' &&
		!['adapter.source-profile', 'service.performance-profile'].includes(unit.id) &&
		!['component', 'page', 'shell', 'layout'].includes(unit.kind) &&
		unit.runtime.targets.some((target) => target.kind === 'module')
	);
}

function sourcePath(id: string): string | null {
	try {
		const path = id.startsWith('file:') ? fileURLToPath(id) : id.split('?')[0];
		return realpathSync(path.startsWith('/@fs/') ? path.slice(4) : path);
	} catch {
		return null;
	}
}

function insideRoot(root: string, path: string): boolean {
	const canonical = sourcePath(root);
	if (!canonical) return false;
	const part = relative(canonical, path);
	return (
		!isAbsolute(part) && part !== '..' && !part.startsWith('../') && !part.includes('node_modules/')
	);
}
