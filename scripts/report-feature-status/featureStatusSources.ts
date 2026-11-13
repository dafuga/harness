// @harness-uid u_xysbnkrzcc
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const statusFolders = ['planned', 'implemented'] as const;

export function featureDocuments(root: string) {
	const roots = [join(root, 'specification', 'features')];
	const packages = join(root, 'packages');
	for (const entry of safeEntries(packages)) {
		if (entry.isDirectory()) roots.push(join(packages, entry.name, 'specification', 'features'));
	}
	return roots.flatMap((featuresRoot) =>
		statusFolders.flatMap((status) =>
			safeEntries(join(featuresRoot, status))
				.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
				.map((entry) => {
					const path = relative(root, join(featuresRoot, status, entry.name));
					return {
						path,
						status,
						metadata: parseMetadata(readFileSync(join(root, path), 'utf8'))
					};
				})
		)
	);
}

export function completeLoopsFor(root: string, docPath: string): string[] {
	const featureBase = docPath.slice(docPath.lastIndexOf('/') + 1, -'.md'.length);
	const loopRoots = [join(root, 'specification', 'loops')];
	const packages = join(root, 'packages');
	for (const entry of safeEntries(packages)) {
		if (entry.isDirectory()) loopRoots.push(join(packages, entry.name, 'specification', 'loops'));
	}
	const loops: string[] = [];
	for (const loopRoot of loopRoots) {
		for (const entry of safeEntries(loopRoot)) {
			if (!entry.isDirectory()) continue;
			const file = join(loopRoot, entry.name, 'loop.json');
			try {
				const loop = JSON.parse(readFileSync(file, 'utf8')) as {
					steps?: Array<{ status?: string }>;
				};
				const trace = readOptional(join(loopRoot, entry.name, 'trace.ndjson'));
				const text = `${readFileSync(file, 'utf8')}\n${trace}`;
				const matches = entry.name === featureBase || text.includes(docPath);
				if (matches && loop.steps?.length && loop.steps.every((step) => step.status === 'complete'))
					loops.push(relative(root, join(loopRoot, entry.name)));
			} catch {
				// Incomplete or invalid loop evidence is not treated as a completed loop.
			}
		}
	}
	return loops;
}

export function filesBelow(directory: string): string[] {
	return safeEntries(directory).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : [];
	});
}

function parseMetadata(text: string) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
	const values = new Map<string, string>();
	const lines = match?.[1].split(/\r?\n/) ?? [];
	for (const line of lines) {
		const field = /^([A-Za-z][\w]*):\s*(.*)$/.exec(line);
		if (field) values.set(field[1], field[2]);
	}
	let unitIds: string[] = [];
	try {
		const parsed = JSON.parse(values.get('unitIds') ?? '[]') as unknown;
		if (Array.isArray(parsed))
			unitIds = parsed.filter((id): id is string => typeof id === 'string');
	} catch {
		unitIds = lines
			.filter((line) => /^\s+-\s+/.test(line))
			.map((line) => line.replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, ''));
	}
	return {
		status: values.get('status'),
		owner: values.get('owner') === 'null' ? null : values.get('owner'),
		reviewedAt: values.get('reviewedAt') === 'null' ? null : values.get('reviewedAt'),
		unitIds
	};
}

function safeEntries(directory: string) {
	try {
		return readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
}

function readOptional(path: string): string {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return '';
	}
}
