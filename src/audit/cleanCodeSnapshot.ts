import { extname } from 'node:path';
import type { AuditFinding } from './types';
import { readReviewInput, reviewHash, type ReviewInputFile } from './cleanCodeFiles';
import { relatedReviewPaths, reviewConventionPaths } from './cleanCodeRelated';
import { readAuditConfig } from './config';

export const maxReviewStateBytes = 24000;

export interface ReviewSnapshot {
	target: ReviewInputFile;
	inputs: ReviewInputFile[];
	contextHash: string;
	state: string;
	contextPaths: string[];
	omittedContext: string[];
}

interface SnapshotInput {
	root: string;
	path: string;
	files: string[];
	findings: AuditFinding[];
}

interface SnapshotState {
	target: { path: string; language: string; code: string };
	related: Array<{ path: string; code: string }>;
	conventions: Array<{ path: string; text: string; partial: boolean }>;
	auditFindings: AuditFinding[];
	omittedContext: string[];
}

export async function snapshotCleanCodeFile(input: SnapshotInput): Promise<ReviewSnapshot> {
	const target = await readReviewInput(input.root, input.path);
	const state: SnapshotState = {
		target: { path: input.path, language: extname(input.path), code: target.contents },
		related: [],
		conventions: [],
		omittedContext: [],
		auditFindings: input.findings.filter((finding) => finding.path === input.path)
	};
	if (stateBytes(state) > maxReviewStateBytes)
		throw new Error('Target exceeds the bounded review context; no code was truncated.');
	const inputs = [target];
	for (const path of relatedReviewPaths(input.path, target.contents, input.files)) {
		await appendRelated(input.root, path, state, inputs);
	}
	for (const path of reviewConventionPaths(input.path))
		await appendConvention(input.root, path, state, inputs);
	if (stateBytes(state) > maxReviewStateBytes)
		throw new Error('Supplied context exceeds the review budget.');
	return {
		target,
		inputs,
		state: JSON.stringify(state),
		contextHash: reviewHash(JSON.stringify(inputs.map((file) => [file.path, file.hash]))),
		contextPaths: inputs.slice(1).map((file) => file.path),
		omittedContext: state.omittedContext
	};
}

async function appendRelated(
	root: string,
	path: string,
	state: SnapshotState,
	inputs: ReviewInputFile[]
): Promise<void> {
	try {
		const file = await readReviewInput(root, path);
		state.related.push({ path, code: file.contents });
		if (Buffer.byteLength(file.contents) > 6000 || stateBytes(state) > maxReviewStateBytes - 2000) {
			state.related.pop();
			state.omittedContext.push(path);
		} else inputs.push(file);
	} catch {
		state.omittedContext.push(path);
	}
}

async function appendConvention(
	root: string,
	path: string,
	state: SnapshotState,
	inputs: ReviewInputFile[]
): Promise<void> {
	try {
		const file = await readReviewInput(root, path);
		const text = conventionText(root, file);
		state.conventions.push({ path, text: text.slice(0, 1800), partial: text.length > 1800 });
		if (stateBytes(state) > maxReviewStateBytes - 500) {
			state.conventions.pop();
			state.omittedContext.push(path);
		} else inputs.push(file);
	} catch {
		// Missing optional convention files are ordinary in non-Harness projects.
	}
}

function stateBytes(state: SnapshotState): number {
	return Buffer.byteLength(JSON.stringify(state));
}

function conventionText(root: string, file: ReviewInputFile): string {
	if (file.path !== 'harness.audit.json') return file.contents;
	const config = readAuditConfig(root);
	return JSON.stringify({
		limits: config.limits,
		cleanCode: config.cleanCode,
		ignore: config.ignore.map(({ path, rule, reason }) => ({ path, rule, reason }))
	});
}
