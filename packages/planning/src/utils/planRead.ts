import { planIdentity, validateIdentity } from './planIdentity';
import { Buffer } from 'node:buffer';
import type {
	PlanDetail,
	DesignVersion,
	ApprovalRecord,
	PlanThread,
	ThreadMessage
} from '../models/Planning.types';
import { planImageCodec } from './planImageCodec';
import type { Git } from './planGit';
import { blob, containing, paths, imageBlob } from './planGit';
import { fail, hash, parse, planData } from './planData';
import { contractHash, filename } from './planValidate';
import { approvable, checkOptions } from './planOptions';
async function immutable<T>(git: Git, rev: string, path: string): Promise<T & { commit: string }> {
	const data = await blob(git, rev, path);
	const commit = await containing(git, rev, path);
	if (!data.equals(await blob(git, commit, path)))
		fail('artifact-tampered', `Immutable artifact changed: ${path}`);
	return { ...parse<T>(data), commit };
}
async function stored(git: Git, rev: string, path: string, expected: string): Promise<void> {
	filename(path.split('/').at(-1)!);
	if (hash(await blob(git, rev, path)) !== expected)
		fail('artifact-tampered', 'Stored file hash mismatch');
}
async function readVersion(git: Git, rev: string, path: string): Promise<DesignVersion> {
	const version = await immutable<DesignVersion>(git, rev, path);
	const base = path.slice(0, -11);
	if (!path.endsWith(`/designs/${version.version}/design.json`))
		fail('artifact-tampered', 'Version identity mismatch');
	if (contractHash(version.contract) !== version.contractHash)
		fail('artifact-tampered', 'Contract hash mismatch');
	filename(version.prompt.file);
	if (version.notes) filename(version.notes.file);
	await stored(git, rev, base + version.prompt.file, version.prompt.sha256);
	if (version.notes) await stored(git, rev, base + version.notes.file, version.notes.sha256);
	for (const image of version.images) await checkImage(git, rev, base, image);
	checkOptions(version);
	for (const option of version.options ?? [])
		if (option.prompt) await stored(git, rev, base + option.prompt.file, option.prompt.sha256);
	return version;
}
async function readThread(git: Git, rev: string, path: string): Promise<PlanThread> {
	const thread = await immutable<PlanThread>(git, rev, path);
	const base = path.slice(0, -11);
	const content = await blob(git, rev, `${base}messages.ndjson`);
	let previous = hash(await blob(git, rev, path));
	const messages = content
		.toString()
		.split('\n')
		.filter(Boolean)
		.map((line, index) => {
			const message = parse<ThreadMessage>(Buffer.from(line));
			if (
				message.previous !== previous ||
				message.sequence !== index + 1 ||
				message.threadId !== thread.id ||
				message.unitId !== thread.unitId
			)
				fail('artifact-tampered', 'Message chain mismatch');
			previous = hash(line);
			return message;
		});
	const history = (await git.run(['log', '--format=%H', rev, '--', `${base}messages.ndjson`]))
		.toString()
		.trim()
		.split('\n');
	for (const commit of history) {
		const ancestor = await blob(git, commit, `${base}messages.ndjson`);
		if (!content.subarray(0, ancestor.length).equals(ancestor))
			fail('artifact-tampered', 'Message history was rewritten');
	}
	return { ...thread, messages };
}
export function approvalMatches(
	record: ApprovalRecord,
	latest: DesignVersion | undefined
): boolean {
	const images = latest ? approvable(latest, record.option) : null;
	if (!latest || !images) return false;
	const bindings = images
		.map(({ file, sha256 }) => ({ file, sha256 }))
		.sort((a, b) => a.file.localeCompare(b.file));
	const recorded = [...record.images].sort((a, b) => a.file.localeCompare(b.file));
	return (
		record.version === latest.version &&
		record.contractHash === latest.contractHash &&
		record.notesSha256 === (latest.notes?.sha256 ?? null) &&
		planData(bindings) === planData(recorded)
	);
}
async function checkImage(
	git: Git,
	rev: string,
	base: string,
	image: DesignVersion['images'][number]
): Promise<void> {
	filename(image.file);
	try {
		const bytes = await imageBlob(git, rev, base + image.file);
		if (hash(bytes) !== image.sha256 || bytes.length !== image.bytes)
			fail('artifact-tampered', 'Image hash mismatch');
		const size = planImageCodec(bytes);
		if (size.width !== image.width || size.height !== image.height)
			fail('artifact-tampered', 'Image dimensions mismatch');
		image.content = 'present';
	} catch (error) {
		if ((error as { code?: string }).code !== 'artifact-missing') throw error;
		image.content = 'missing';
	}
}
function derived(
	plan: PlanDetail,
	latest: DesignVersion | undefined,
	approval: ApprovalRecord | null
) {
	let lifecycle: PlanDetail['lifecycle'] = latest ? 'review' : 'draft';
	if (approval) lifecycle = 'approved';
	return {
		contract: latest?.contract ?? plan.contract,
		contractHash: latest?.contractHash ?? plan.contractHash,
		latestVersion: latest?.version ?? null,
		lifecycle
	};
}
export async function planRead(git: Git, rev: string, unitId: string): Promise<PlanDetail> {
	const path = await planIdentity(git, rev, unitId);
	const plan = await immutable<PlanDetail>(git, rev, `${path}/plan.json`);
	await validateIdentity(git, rev, plan);
	if (
		plan.unitId !== unitId ||
		plan.path !== path ||
		contractHash(plan.contract) !== plan.contractHash
	)
		fail('artifact-tampered', 'Plan identity mismatch');
	const files = await paths(git, rev, path);
	const versions = await Promise.all(
		files
			.filter((p) => /\/designs\/v\d+\/design.json$/.test(p))
			.sort()
			.map((p) => readVersion(git, rev, p))
	);
	versions.sort((a, b) => Number(a.version.slice(1)) - Number(b.version.slice(1)));
	for (const [index, design] of versions.entries()) {
		if (design.unitId !== unitId || Number(design.version.slice(1)) !== index + 1)
			fail('artifact-tampered', 'Design sequence mismatch');
	}
	const latest = versions.at(-1);
	const approvals = await Promise.all(
		files
			.filter((p) => /\/designs\/approvals\/.+\.json$/.test(p))
			.sort()
			.map((p) => immutable<ApprovalRecord>(git, rev, p))
	);
	approvals.sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));
	for (const approval of approvals) approval.current = approvalMatches(approval, latest);
	const approval = approvals.filter((a) => a.current).at(-1) ?? null;
	const threads = await Promise.all(
		files
			.filter((p) => /\/threads\/.+\/thread.json$/.test(p))
			.sort()
			.map((p) => readThread(git, rev, p))
	);
	threads.sort((a, b) => a.pin - b.pin);
	return {
		...plan,
		versions,
		approvals,
		threads,
		approval,
		...derived(plan, latest, approval),
		verified: false,
		versionCount: versions.length,
		threadCount: threads.length,
		registered: (await paths(git, rev, `specification/units/${unitId}.json`)).length > 0
	};
}
