import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import {
	consoleAccess,
	consolePolicy,
	type ConsoleAccess,
	type ConsoleData
} from '../../../../../../src/lib/console';
import { ReportExportSerializer } from '../../../serializers/reports-media/ReportExportSerializer';
import { consoleExport } from './consoleExport';
import { mediaMime } from '../../verification-evidence/evidenceMedia';
import { reportRuntimeRoot } from '../../reports-media/reportRuntimeRoot';
import { SourceImpactService } from '../../../../../../src/services/explorer-ui/revision-detail-service/source-impact-service/SourceImpactService';
import type { Measurement } from '../../../../../../src/core/verification-evidence/verificationTypes';
import type { HarnessRevision } from '../../../models/explorer-ui/Harness.types';

// Cache only immutable commit observations, not source indexes or mutable branch answers.
const measured = new Map<string, Promise<Measurement[]>>();

async function sourceFigures(root: string, commit: string): Promise<Measurement[]> {
	const key = `${resolve(root)}\n${commit}`;
	const known = measured.get(key);
	if (known) return known;
	const pending = new SourceImpactService(root).measurements(commit);
	measured.set(key, pending);
	if (measured.size > 4) measured.delete(measured.keys().next().value!);
	pending.then(
		(rows) => {
			if (!rows.length) measured.delete(key);
		},
		() => measured.delete(key)
	);
	return pending;
}

function currentFigures(unit: HarnessRevision['registry']['units'][number], commit: string) {
	return ['source-bytes', 'complexity'].every((metric) =>
		unit.sourceMeasurements?.some(
			(item) => item.metric === metric && item.testedRevision === commit
		)
	);
}

function selectedRevision(path: string, json: string | undefined): HarnessRevision | undefined {
	const commit = /^revisions\/([a-f0-9]{40})\.json$/.exec(path)?.[1];
	if (!commit || !json) return;
	const revision = JSON.parse(json) as HarnessRevision;
	if (revision.commit === commit && Array.isArray(revision.registry?.units)) return revision;
}

/** Old prepared indexes can lack static figures; derive them without changing stored proof. */
async function measuredRevision(
	path: string,
	json: string | undefined
): Promise<string | undefined> {
	const root = process.env.HARNESS_SITE_ROOT?.trim();
	if (!root) return json;
	const revision = selectedRevision(path, json);
	if (!revision || revision.moduleData?.required) return json;
	const commit = revision.commit;
	const units = revision.registry.units;
	if (units.every((unit) => currentFigures(unit, commit))) return json;
	const figures = await sourceFigures(root, commit);
	if (!figures.length) return json;
	for (const unit of units)
		unit.sourceMeasurements = figures.filter((item) => item.unit === unit.id);
	return JSON.stringify(revision);
}

/** The directory `harness history build` wrote, when this server was given one. */
export function consoleDirectory(): string | undefined {
	const directory = process.env.HARNESS_CONSOLE_DATA?.trim();
	return directory ? resolve(directory) : undefined;
}

async function inside(directory: string | undefined, path: string): Promise<Buffer | undefined> {
	if (!directory) return undefined;
	const target = resolve(directory, path);
	if (!target.startsWith(directory + sep)) return undefined;
	return readFile(target).catch(() => undefined);
}

/** Console data read from the history directory on disk; used by Harness's own local server. */
function consoleFiles(): ConsoleData {
	return {
		async json(path) {
			return measuredRevision(path, (await inside(consoleDirectory(), path))?.toString('utf8'));
		},
		async media(name) {
			const bytes = await inside(consoleDirectory(), `media/${name}`);
			return bytes ? { bytes: new Uint8Array(bytes), type: mediaMime(name) } : undefined;
		}
	};
}

/** The history files themselves, for server code that has already passed the guard. */
export const consoleData: ConsoleData = consoleFiles();

let access: ConsoleAccess | undefined;

/**
 * The guard in front of everything this server serves. Harness's own server has one owner: it
 * admits a request only in explicit owner mode, bound to loopback, from a loopback peer.
 */
export function consoleServer(): ConsoleAccess {
	access ??= consoleAccess({
		policy: consolePolicy({
			mode: process.env.HARNESS_OWNER_MODE,
			bind: process.env.HARNESS_BIND ?? process.env.HOST,
			addressHeader: process.env.ADDRESS_HEADER
		}),
		data: consoleData,
		// The portable page is built with the viewer this server compiled.
		exporter: async (input) =>
			consoleExport(input, await new ReportExportSerializer(reportRuntimeRoot()).assets())
	});
	return access;
}
