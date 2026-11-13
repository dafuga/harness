// @harness-uid u_xysbnkrzcc
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { completeLoopsFor, featureDocuments, filesBelow } from './featureStatusSources';

const evidenceRef = 'refs/heads/harness-evidence';

/** Reports stale planned labels without changing a document or deciding that work shipped. */
export function featureStatusReport(root: string, verifiedUnitIds: ReadonlySet<string>) {
	const docs = featureDocuments(root);
	const stalePlanned = docs
		.filter(({ status }) => status === 'planned')
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
		maxBuffer: 16 * 1024 * 1024,
		timeout: 30000
	});
}

export function main(): void {
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
