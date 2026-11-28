// @harness-uid u_m2u5jrwnyg
import {
	trackerPlanningArtifactFields,
	trackerPlanningPromotionFields
} from '../../../utils/projects-sessions/trackerPlanning';

export const itemSql = `
	SELECT id, status, agent, owner, kind, auto IS NOT NULL AND auto <> '' AS auto_launch,
		remind_at, every, CASE WHEN length(title) <= 16384 THEN title ELSE '' END AS title,
		CASE WHEN length(coalesce(nullif(project, ''), agent)) <= 1024
			THEN coalesce(nullif(project, ''), agent) END AS project,
		updated_at, due, needs_daniel, resolved,
		${[...trackerPlanningArtifactFields, ...trackerPlanningPromotionFields].join(', ')},
		CASE WHEN length(question) <= 16384 THEN question END AS question,
		CASE WHEN length(options) <= 4096 THEN options END AS options, confirm,
		CASE WHEN length(attachments) <= 8192 THEN attachments END AS attachments,
		CASE WHEN needs_daniel = 1 AND resolved = 0 AND length(attachment_docs) <= 524288
			THEN attachment_docs END AS attachment_docs,
		coalesce(json_extract(clocks, '$.question'), json_extract(clocks, '$.needs_daniel')) AS flag_clock,
		json_array(json_extract(clocks, '$.question'), json_extract(clocks, '$.needs_daniel'),
			json_extract(clocks, '$.resolved'), json_extract(clocks, '$.answered_at'),
			json_extract(clocks, '$.answer')) AS attention_clock
	FROM items
	WHERE deleted = 0 AND coalesce(sensitive, 0) = 0 AND title IS NOT NULL
		AND length(id) BETWEEN 1 AND 80 AND id NOT GLOB '*[^a-z0-9_-]*'
		AND status IN ('open', 'in_progress', 'blocked', 'done', 'ignored')
		AND (status NOT IN ('done', 'ignored') OR (needs_daniel = 1 AND resolved = 0)
			OR updated_at >= ?)
	ORDER BY (status IN ('done', 'ignored') AND NOT (needs_daniel = 1 AND resolved = 0)),
		updated_at DESC, id
	LIMIT 2000
`;

export const noteSql = `
	SELECT notes.hlc, coalesce(ops.actor, notes.node) AS author,
		CASE WHEN length(notes.text) <= 16384 THEN notes.text ELSE NULL END AS text
	FROM item_notes AS notes LEFT JOIN ops ON ops.op_id = notes.hlc
	WHERE notes.item_id = ? ORDER BY notes.hlc DESC LIMIT 10
`;
