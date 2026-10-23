export interface CallableContract {
	pure?: boolean;
	consumers?: Array<{ unit: string; symbol?: string }>;
}
