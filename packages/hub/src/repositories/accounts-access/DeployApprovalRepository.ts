// @harness-uid u_lrganksse4
import {
	approvalCard,
	approvalReceipt
} from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox';
import type {
	ApprovalCard,
	ApprovalCards,
	ApprovalDecision
} from '../../../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';
import type {
	ApprovalRow,
	Collect,
	DecisionSession,
	RunnerScope
} from './DeployApprovalRepository.types';

const liveSession = `EXISTS (SELECT 1 FROM auth_sessions AS s
	WHERE s.id_hash = SESSION_REF AND s.actor_id = owner AND s.kind = 'native'
	AND s.resource = 'projects' AND s.revoked_at IS NULL AND s.expires_at > ?)`;
const recent = 24 * 60 * 60 * 1000;
const runnerMatch =
	'id = ? AND plan = ? AND project = ? AND environment = ? AND owner = ? AND runner_hash = ? AND expires_at > ?';

export class DeployApprovalRepository {
	constructor(private readonly db: D1Database) {}

	async list(owner: string, now: number): Promise<ApprovalCards> {
		const { results } = await this.db
			.prepare(
				`SELECT * FROM deploy_approval_requests WHERE owner = ? AND expires_at > ?
			ORDER BY (decision IS NULL AND expires_at > ?) DESC, expires_at DESC LIMIT 40`
			)
			.bind(owner, now - recent, now)
			.all<ApprovalRow>();
		return results.map((row) => ({
			...approvalCard.parse(JSON.parse(row.card)),
			receipt: readReceipt(row),
			used: row.used_at !== null
		}));
	}

	async register(card: ApprovalCard, scope: RunnerScope): Promise<boolean> {
		await this.db
			.prepare('DELETE FROM deploy_approval_requests WHERE expires_at <= ?')
			.bind(scope.now - recent)
			.run();
		const row = await this.db
			.prepare(
				`INSERT INTO deploy_approval_requests
			(id, plan, project, environment, owner, runner_hash, card, expires_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING id`
			)
			.bind(
				card.id,
				card.plan,
				card.project,
				card.environment,
				scope.owner,
				scope.runnerHash,
				JSON.stringify(card),
				card.expiresAt
			)
			.first();
		return row !== null;
	}

	async decide(input: ApprovalDecision, scope: DecisionSession) {
		const row = await this.db
			.prepare(
				`UPDATE deploy_approval_requests SET decision = ?, receipt = ?, session_hash = ?, decided_at = ?
			WHERE id = ? AND plan = ? AND owner = ? AND expires_at > ? AND decision IS NULL
			AND ${liveSession.replace('SESSION_REF', '?')} RETURNING *`
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
				scope.now
			)
			.first<ApprovalRow>();
		return readReceipt(row);
	}

	async collect(input: Collect, scope: RunnerScope) {
		const args = [
			input.id,
			input.plan,
			input.project,
			input.environment,
			scope.owner,
			scope.runnerHash,
			scope.now
		];
		const row = await this.db
			.prepare(
				`UPDATE deploy_approval_requests SET used_at = ? WHERE ${runnerMatch}
			AND used_at IS NULL AND decision = 'allow' AND ${liveSession.replace('SESSION_REF', 'session_hash')}
			RETURNING *`
			)
			.bind(scope.now, ...args, scope.now)
			.first<ApprovalRow>();
		if (row) return { status: 'allowed', receipt: readReceipt(row) };
		const current = await this.db
			.prepare(`SELECT decision FROM deploy_approval_requests WHERE ${runnerMatch}`)
			.bind(...args)
			.first<Pick<ApprovalRow, 'decision'>>();
		return { status: current?.decision === null ? 'pending' : 'refused' };
	}
}

function readReceipt(row: ApprovalRow | null) {
	return row?.receipt
		? approvalReceipt.parse({
				id: row.id,
				plan: row.plan,
				actor: row.owner,
				receipt: row.receipt,
				decision: row.decision,
				decidedAt: row.decided_at
			})
		: null;
}
