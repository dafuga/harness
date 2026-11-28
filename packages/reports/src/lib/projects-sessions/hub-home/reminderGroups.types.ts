// @harness-uid u_bnpelpb6nh
export interface ReminderGrouped {
	group?: 'work' | 'personal';
	project?: string | null;
}

export interface ReminderGroup<Row> {
	id: 'work' | 'personal';
	label: string;
	rows: Row[];
	/** Work has one section per project; Personal has one without a name. */
	sections: { project: string | null; rows: Row[] }[];
	empty: string;
}
