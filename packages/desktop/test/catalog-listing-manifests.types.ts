/**
 * The manifests of a project in which one identity is a rendered page at an earlier commit and
 * only a loader at the tip. What a manifest owns at a commit is all that says which it is there:
 * an ordinary page has the title of that loader, and the twin has its sentence as well.
 */
export type Listing = [id: string, title: string, responsibility: string, source: string[]];
