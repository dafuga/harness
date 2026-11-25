// @harness-uid u_lrganksse4
import {
	approvalCard,
	approvalReceipt,
	deployProgress
} from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import type {
	ApprovalCard,
	ApprovalCards,
	ApprovalDecision
} from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
import type {
	ApprovalRow,
	Admit,
	Collect,
	DecisionSession,
	Report,
	RunnerScope
} from './DeployApprovalRepository.types';

const liveSession = `EXISTS (SELECT 1 FROM auth_sessions AS s
	WHERE s.id_hash = SESSION_REF AND s.actor_id = owner AND s.kind = 'native'
	AND s.resource = 'projects' AND s.revoked_at IS NULL AND s.expires_at > ?)`;
const recent = 24 * 60 * 60 * 1000;
const runnerMatch =
	'id = ? AND plan = ? AND project = ? AND environment = ? AND owner = ? AND runner_hash = ?';
const approvals = 'deploy_approval_requests';
const runs = 'deploy_control_requests';
const receiptColumns = 'id, plan, owner, card, receipt, decision, decided_at, used_at, expires_at';
const executable = `json_type(card, '$.control.preview') IS NULL`;
const currentGrant = `EXISTS (SELECT 1 FROM json_each(?) AS grants
	WHERE grants.key = project || ':' || environment AND grants.value = runner_hash)`;
const allowSession = liveSession.replace('SESSION_REF', 'session_hash');
const goSession = liveSession.replace('SESSION_REF', 'go_session_hash');
const prior = `COALESCE(json_extract(progress, '$.phase'), '')`;
const retained = `(admitted_at IS NOT NULL AND ${prior} NOT IN ('complete', 'signed-off', 'not-applied'))`;

export class DeployApprovalRepository {
	constructor(private readonly db: D1Database) {}

	async list(owner: string, now: number): Promise<ApprovalCards> {
		const { results } = await this.db
			.prepare(
				`SELECT * FROM (
				SELECT ${receiptColumns}, NULL AS go_at, NULL AS progress FROM ${approvals} WHERE owner = ? AND expires_at > ?
				UNION ALL
				SELECT ${receiptColumns}, go_at, progress FROM ${runs} WHERE owner = ? AND (expires_at > ? OR ${retained})
			)
			ORDER BY (decision IS NULL AND expires_at > ?) DESC, expires_at DESC LIMIT 40`
			)
			.bind(owner, now - recent, owner, now - recent, now)
			.all<ApprovalRow>();
		return results.map((row) => ({
			...approvalCard.parse(JSON.parse(row.card)),
			receipt: readReceipt(row),
			used: row.used_at !== null,
			...(row.go_at !== null ? { goAt: row.go_at } : {}),
			...(row.progress !== null ? { progress: deployProgress.parse(JSON.parse(row.progress)) } : {})
		}));
	}

	async register(card: ApprovalCard, scope: RunnerScope): Promise<boolean> {
		const table = card.control ? runs : approvals;
		const other = card.control ? approvals : runs;
		await this.db
			.prepare(
				`DELETE FROM ${table} WHERE expires_at <= ? ${table === runs ? `AND NOT ${retained}` : ''}`
			)
			.bind(scope.now - recent)
			.run();
		const row = await this.db
			.prepare(
				`INSERT INTO ${table}
			(id, plan, project, environment, owner, runner_hash, card, expires_at)
			SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM ${other} WHERE id = ?)
			ON CONFLICT(id) DO NOTHING RETURNING id`
			)
			.bind(...runnerArgs(card, scope), JSON.stringify(card), card.expiresAt, card.id)
			.first();
		return row !== null;
	}

	async decide(input: ApprovalDecision, scope: DecisionSession) {
		if (input.decision === 'go') return authorizeGo(this.db, input, scope);
		const table = await decisionTable(this.db, input.id);
		const row = await this.db
			.prepare(
				`UPDATE ${table} SET decision = ?, receipt = ?, session_hash = ?, decided_at = ?
			WHERE id = ? AND plan = ? AND owner = ? AND expires_at > ? AND decision IS NULL
			${table === runs ? `AND progress IS NULL AND ${executable}` : ''}
			AND ${liveSession.replace('SESSION_REF', '?')} AND ${currentGrant} RETURNING *`
			)
			.bind(
				input.decision,
				crypto.randomUUID(),
				scope.sessionHash,
				scope.now,
				input.id,
				input.plan,
				scope.owner,
				scope.now,
				scope.sessionHash,
				scope.now,
				scope.grants
			)
			.first<ApprovalRow>();
		return readReceipt(row);
	}

	async collect(input: Collect, scope: RunnerScope) {
		const table = await decisionTable(this.db, input.id);
		const runGuard = table === runs ? `AND progress IS NULL AND ${executable}` : '';
		const args = [...runnerArgs(input, scope), scope.now];
		const at = table === runs ? [scope.now, scope.now] : [scope.now];
		const row = await this.db
			.prepare(
				`UPDATE ${table} SET used_at = ? WHERE ${runnerMatch} AND expires_at > ?
			AND used_at IS NULL AND decision = 'allow' AND ${allowSession} ${runGuard}
			${table === runs ? `AND go_at IS NOT NULL AND ${goSession}` : ''}
			RETURNING *`
			)
			.bind(scope.now, ...args, ...at)
			.first<ApprovalRow>();
		if (row) return { status: 'allowed', receipt: readReceipt(row) };
		const current = await this.db
			.prepare(
				`SELECT id FROM ${table} WHERE ${runnerMatch} AND expires_at > ? ${runGuard}
			AND (decision IS NULL ${table === runs ? "OR (decision = 'allow' AND go_at IS NULL)" : ''})`
			)
			.bind(...args)
			.first();
		return { status: current ? 'pending' : 'refused' };
	}
}

async function decisionTable(db: D1Database, id: string) {
	const controlled = await db.prepare(`SELECT id FROM ${runs} WHERE id = ?`).bind(id).first();
	return controlled ? runs : approvals;
}

async function authorizeGo(db: D1Database, input: ApprovalDecision, scope: DecisionSession) {
	const row = await db
		.prepare(
			`UPDATE ${runs} SET go_at = ?, go_session_hash = ?
		WHERE id = ? AND plan = ? AND owner = ? AND expires_at > ? AND decision = 'allow'
		AND ${executable} AND go_at IS NULL AND progress IS NULL AND used_at IS NULL
		AND ${allowSession} AND ${liveSession.replace('SESSION_REF', '?')} AND ${currentGrant}
		RETURNING go_at AS goAt`
		)
		.bind(
			scope.now,
			scope.sessionHash,
			input.id,
			input.plan,
			scope.owner,
			scope.now,
			scope.now,
			scope.sessionHash,
			scope.now,
			scope.grants
		)
		.first<{ goAt: number }>();
	return row && { id: input.id, plan: input.plan, goAt: row.goAt };
}

export async function admitDeployRun(db: D1Database, input: Admit, scope: RunnerScope) {
	return db
		.prepare(
			`UPDATE ${runs} SET admitted_at = ?
		WHERE ${runnerMatch} AND expires_at > ? AND ${executable} AND progress IS NULL
		AND decision = 'allow' AND used_at IS NOT NULL AND go_at IS NOT NULL AND admitted_at IS NULL
		AND ${allowSession} AND ${goSession} RETURNING id`
		)
		.bind(scope.now, ...runnerArgs(input, scope), scope.now, scope.now, scope.now)
		.first();
}

export async function reportDeployRun(db: D1Database, input: Report, scope: RunnerScope) {
	const progress = JSON.stringify(input.progress);
	return db
		.prepare(
			`UPDATE ${runs} SET progress = ?
		WHERE ${runnerMatch} AND ${executable}
		AND (progress = ? OR (${progressTransition})) RETURNING id`
		)
		.bind(progress, ...runnerArgs(input, scope), progress)
		.first();
}

const progressTransition = `CASE json_extract(?1, '$.phase')
	WHEN 'stopped' THEN admitted_at IS NULL AND progress IS NULL
	WHEN 'signed-off' THEN admitted_at IS NOT NULL AND json_extract(card, '$.action') = 'signoff' AND progress IS NULL
	ELSE admitted_at IS NOT NULL AND json_extract(card, '$.action') != 'signoff' AND CASE json_extract(?1, '$.phase')
		WHEN 'applying' THEN ${prior} = ''
		WHEN 'not-applied' THEN ${prior} IN ('', 'applying')
		WHEN 'deployed' THEN ${prior} IN ('', 'applying')
		WHEN 'verified' THEN ${prior} IN ('', 'applying', 'deployed')
		WHEN 'cleanup-failed' THEN ${prior} IN ('', 'applying', 'deployed', 'verified')
		WHEN 'complete' THEN ${prior} IN ('', 'applying', 'deployed', 'verified', 'cleanup-failed')
		ELSE 0 END END`;

function runnerArgs(
	{ id, plan, project, environment }: Pick<Collect, 'id' | 'plan' | 'project' | 'environment'>,
	scope: RunnerScope
) {
	return [id, plan, project, environment, scope.owner, scope.runnerHash];
}

function readReceipt(row: ApprovalRow | null) {
	if (!row?.receipt) return null;
	return approvalReceipt.parse({
		id: row.id,
		plan: row.plan,
		actor: row.owner,
		receipt: row.receipt,
		decision: row.decision,
		decidedAt: row.decided_at
	});
}
