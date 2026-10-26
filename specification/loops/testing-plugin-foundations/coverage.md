# Generated testing foundation categories

The initial testing templates emitted configs into an undeclared testing category.
The existing scaffold audit fixture checked generated resources but omitted default
and optional testing setup files. Its standard admission now installs both testing
foundations and requires no module-category-folder findings for their emitted files.

The repair uses each plugin category already declared by installation. The committed
failing checkpoint is replayed in an isolated snapshot as the prevention guard.
The same unchanged audit test must pass on the repaired source.
