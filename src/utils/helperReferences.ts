

export interface HelperBinding {
	specifier?: string;
	imported: string;
}

export interface HelperReference extends HelperBinding {
	caller: string | null;
}

export interface HelperFacts {
	references: HelperReference[];
	forwards: Array<HelperBinding & { name: string }>;
}

export { helperReferences } from '../services/revision-detail-service/helperReferences';
