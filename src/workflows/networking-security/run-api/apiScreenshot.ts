import type { HarnessApiService } from '../../../services/networking-security/HarnessApiService';
import type { HarnessApiOptions } from '../../../services/networking-security/HarnessApiService.types';
import type {
	EntityEvidenceResult,
	EvidenceArtifactQuery
} from '../../../../packages/desktop/src/models/verification-evidence/DesktopEvidence.types';
import type {
	ExplorerCapture,
	ExplorerSide
} from '../../../../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fail } from '../../../core/development-tooling/errors';

/**
 * Download a recorded capture of this page, with all artifact bindings and its hash intact. A
 * capture that stands as proof is preferred; otherwise one of a failed or incomplete record is
 * returned, and its verification says so, so it is never presented as passed.
 */
export async function apiScreenshot(
	client: HarnessApiService,
	entityId: string,
	options: HarnessApiOptions
) {
	const size = screenshotSize(options);
	if (!options.output || options.output === '-')
		fail('Screenshot downloads require --output <file>.');
	const snapshot = await client.snapshot();
	const query = {
		entityId,
		branch: snapshot.revision.branch,
		commit: snapshot.revision.commit,
		mode: options.commit ? 'commit' : 'current'
	} as const;
	const result = (await client.read('evidence', query)).data as EntityEvidenceResult;
	const sideName = options.side ?? 'after';
	if (!['before', 'after'].includes(sideName)) fail('Screenshot side must be before or after.');
	const side = result.evidence[sideName];
	const selected = selectedCapture(side, options, size);
	const binding = artifactBinding(result, { ...query, side: sideName }, selected);
	const artifact = await client.read('artifact', { ...binding });
	const { capture, scenario, state, inheritedFrom, focused } = selected;
	if (createHash('sha256').update(artifact.bytes).digest('hex') !== capture.sha256)
		fail('Screenshot SHA-256 integrity check failed.');
	if (!artifact.mediaType.startsWith('image/')) fail('The recorded artifact is not an image.');
	await writeFile(options.output, artifact.bytes, { flag: 'wx' });
	return {
		path: resolve(options.output),
		entityId,
		commit: side!.commit,
		scenario,
		state,
		viewport: capture.viewport ?? null,
		sha256: capture.sha256,
		mediaType: artifact.mediaType,
		capturedAt: capture.capturedAt,
		inheritedFrom,
		focused: focused ?? null,
		verification: verificationOf(side!, selected)
	};
}

/** What the record says about the capture, stated as recorded and never upgraded to passed. */
function verificationOf(side: ExplorerSide, selected: ExplorerCapture) {
	const record = recordFor(side, selected);
	const status = selected.focused ? null : (record?.status ?? null);
	const proven = selected.usable;
	return {
		record: selected.focused?.record ?? record?.id ?? null,
		status,
		standing: selected.standing,
		usable: proven,
		note: proven
			? 'This capture stands as proof for its record.'
			: `Not proof: record ${status ?? 'status unknown'}, capture ${selected.standing}. Inspect it, do not cite it as passed.`
	};
}

function selectedCapture(
	side: ExplorerSide | null,
	options: HarnessApiOptions,
	size: readonly [number, number] | undefined
): ExplorerCapture {
	const matching =
		side?.captures.filter(
			(item) => matchesCapture(item, options) && (!size || matchesSize(item, side, size))
		) ?? [];
	const proven = matching.filter((item) => item.usable);
	const captures = proven.length ? proven : matching;
	if (captures.length !== 1)
		fail(
			captures.length
				? 'Several screenshots match; select --viewport or --size, plus --state and --scenario.'
				: 'No recorded screenshot matches this entity and revision. Run its standard capture scenario first.'
		);
	return captures[0];
}

function matchesCapture(item: ExplorerCapture, options: HarnessApiOptions): boolean {
	if (item.capture.kind !== 'screenshot' || item.standing === 'unvalidated') return false;
	if (!item.usable && item.capture.media === null) return false;
	return (
		(!options.viewport || item.capture.viewport === options.viewport) &&
		(!options.state || item.state === options.state) &&
		(!options.scenario || item.scenario === options.scenario)
	);
}

function artifactBinding(
	result: EntityEvidenceResult,
	query: Pick<EvidenceArtifactQuery, 'entityId' | 'branch' | 'commit' | 'mode' | 'side'>,
	selected: ExplorerCapture
): EvidenceArtifactQuery {
	const { capture, scenario, state, focused } = selected;
	const side = result.evidence[query.side];
	const recordId = focused?.record ?? (side ? recordFor(side, selected)?.id : undefined);
	if (!recordId) fail('The screenshot has no record binding.');
	return {
		...query,
		recordId,
		scenarioId: scenario,
		state,
		evidenceId: capture.evidence,
		viewport: capture.viewport ?? null,
		sha256: capture.sha256,
		notesRevision: result.identity.notesRevision,
		evidenceRevision: result.identity.evidenceRevision
	};
}

function recordFor(side: ExplorerSide, capture: ExplorerCapture) {
	return capture.recordId
		? (side.detail?.records.find((record) => record.id === capture.recordId) ?? side.record)
		: side.record;
}

/** An exact CSS viewport filter; absence preserves selection by recorded viewport id. */
function screenshotSize(options: HarnessApiOptions): readonly [number, number] | undefined {
	if (options.size === undefined) return undefined;
	if (options.viewport !== undefined) fail('--size and --viewport are mutually exclusive.');
	const message =
		'--size must be WIDTHxHEIGHT in CSS pixels, with integers from 1 to 16384 and no spaces or leading zeros (for example 390x844).';
	if (
		!/^[1-9][0-9]{0,4}x[1-9][0-9]{0,4}$/.test(options.size) ||
		options.size.trim() !== options.size
	)
		fail(message);
	const [width, height] = options.size.split('x').map(Number);
	if (width > 16384 || height > 16384) fail(message);
	return [width, height];
}

/** Never infer viewport dimensions from a preset name or from the clipped image's pixels. */
function matchesSize(
	item: ExplorerCapture,
	side: ExplorerSide,
	size: readonly [number, number]
): boolean {
	const viewport = item.focused ? item.focused.viewport : recordedViewport(item, side);
	return viewport?.width === size[0] && viewport?.height === size[1];
}

function recordedViewport(item: ExplorerCapture, side: ExplorerSide) {
	// An inherited record needs its own dimensions; the selected revision cannot supply them.
	if (item.inheritedFrom || recordFor(side, item)?.source?.commit !== side.commit) return undefined;
	const scenario = side.detail?.registry.scenarios.find((entry) => entry.id === item.scenario);
	return scenario?.viewports.find((entry) => entry.id === item.capture.viewport);
}
