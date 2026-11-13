import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const statusFolders = ['planned', 'implemented'] as const;
const evidenceRef = 'refs/heads/harness-evidence';

/** Reports stale planned labels without changing a document or deciding that work shipped. */
export function featureStatusReport(root: string, verifiedUnitIds: ReadonlySet<string>) {
	const docs = featureDocuments(root);
	const stalePlanned = docs
		.filter(({ status, path, metadata }) => status === 'planned')
		.flatMap(({ path, metadata }) => {
			const reasons: string[] = [];
			for (const loop of completeLoopsFor(root, path)) reasons.push(`complete loop ${loop}`);
			const verified = metadata.unitIds.filter((id) => verifiedUnitIds.has(id));
			if (verified.length > 0) reasons.push(`verified units ${verified.join(', ')}`);
			return reasons.length > 0 ? [{ path, reasons }] : [];
		});
	return {
		documents: docs.length,
		planned: docs.filter((doc) => doc.status === 'planned').length,
		implemented: docs.filter((doc) => doc.status === 'implemented').length,
		classificationMismatches: docs.flatMap(({ path, status, metadata }) =>
			metadata.status === status
				? []
				: [{ path, folderStatus: status, frontmatterStatus: metadata.status }]
		),
		stalePlanned,
		missingOwnershipOrDateEvidence: docs.flatMap(({ path, metadata }) => {
			const missing = [
				...(metadata.owner === null || metadata.owner === undefined ? ['owner'] : []),
				...(metadata.reviewedAt === null || metadata.reviewedAt === undefined ? ['reviewedAt'] : [])
			];
			return missing.length > 0 ? [{ path, fields: missing }] : [];
		})
	};
}

/** Units explicitly linked to feature docs by their manifest documentation field. */
export function linkedUnits(root: string): Map<string, string[]> {
	const linked = new Map<string, string[]>();
	const unitsDirectory = join(root, 'specification', 'units');
	for (const file of filesBelow(unitsDirectory).filter((path) => path.endsWith('.json'))) {
		try {
			const unit = JSON.parse(readFileSync(file, 'utf8')) as {
				id?: unknown;
				documentation?: unknown;
			};
			if (typeof unit.id !== 'string' || typeof unit.documentation !== 'string') continue;
			const ids = linked.get(unit.documentation) ?? [];
			ids.push(unit.id);
			linked.set(unit.documentation, ids);
		} catch {
			// Invalid unit manifests remain the responsibility of the existing units check.
		}
	}
	return linked;
}

/** A passed, committed verification record is a warning signal only, never shipment evidence. */
export function verifiedUnitsInHistory(root: string, unitIds: ReadonlySet<string>): Set<string> {
	if (unitIds.size === 0 || !refExists(root, evidenceRef)) return new Set();
	const verified = new Set<string>();
	for (const unitId of unitIds) {
		let candidates = '';
		try {
			const escaped = unitId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			candidates = git(root, [
				'grep',
				'-l',
				'-E',
				`"unit"[[:space:]]*:[[:space:]]*"${escaped}"`,
				evidenceRef,
				'--',
				'records/**/record.json'
			]);
		} catch {
			continue;
		}
		for (const result of candidates.split('\n').filter(Boolean)) {
			try {
				const path = result.slice(result.indexOf(':') + 1);
				const record = JSON.parse(git(root, ['show', `${evidenceRef}:${path}`])) as {
					status?: string;
					components?: Array<{ unit?: string }>;
				};
				if (
					record.status === 'passed' &&
					record.components?.some((component) => component.unit === unitId)
				) {
					verified.add(unitId);
					break;
				}
			} catch {
				// Missing or malformed historical records are not verification evidence.
			}
		}
	}
	return verified;
}

function featureDocuments(root: string) {
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
					return { path, status, metadata: parseMetadata(readFileSync(join(root, path), 'utf8')) };
				})
		)
	);
}

function completeLoopsFor(root: string, docPath: string): string[] {
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

function filesBelow(directory: string): string[] {
	return safeEntries(directory).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : [];
	});
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

function refExists(root: string, ref: string): boolean {
	try {
		git(root, ['rev-parse', '--verify', ref]);
		return true;
	} catch {
		return false;
	}
}

function git(root: string, args: string[]): string {
	return execFileSync('git', ['-C', root, ...args], {
		encoding: 'utf8',
		maxBuffer: 16 * 1024 * 1024
	});
}

if (import.meta.main) {
	const root = process.cwd();
	const linked = linkedUnits(root);
	const docs = featureDocuments(root);
	const featurePaths = new Set(docs.map(({ path }) => path));
	const declaredUnits = new Set(
		docs.flatMap(({ path, metadata }) => [...metadata.unitIds, ...(linked.get(path) ?? [])])
	);
	const report = featureStatusReport(root, verifiedUnitsInHistory(root, declaredUnits));
	console.log(
		JSON.stringify(
			{
				...report,
				unitLinks: [...linked.entries()]
					.filter(([path]) => featurePaths.has(path))
					.map(([path, unitIds]) => ({ path, unitIds })),
				ownershipAndDateEvidence: 'unknown unless owner and reviewedAt are explicitly present'
			},
			null,
			2
		)
	);
}
