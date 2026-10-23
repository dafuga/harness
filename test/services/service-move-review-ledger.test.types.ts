export interface ReviewedFile {
	unit: string;
	to: string;
	definition: string;
	review?: { commit: string; path: string; definition: string; reason: string };
}
