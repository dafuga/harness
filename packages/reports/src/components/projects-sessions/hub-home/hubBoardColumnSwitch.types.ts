// @harness-uid u_yfhvbaf35l
/** The four board columns, in board order. */
export type BoardColumnId = 'todo' | 'active' | 'blocked' | 'done';

/** One part of the iPhone column switch. */
export interface BoardSwitchColumn {
	id: BoardColumnId;
	/** Short name under the count: "To do", "In progress", "Blocked", "Done". */
	label: string;
	count: number;
	/** Cards in this column that need Daniel; above zero shows the accent mark beside the count. */
	needsYou?: number;
}

export interface HubBoardColumnSwitchProps {
	columns: BoardSwitchColumn[];
	selected: BoardColumnId;
	onselect: (id: BoardColumnId) => void;
}
