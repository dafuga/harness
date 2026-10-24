# Translations catalog

Browse registered app strings in English and French at the selected source revision.

- Add Translations navigation and branch/commit routes.
- Read svelte-i18n dictionaries statically, including inline objects and imported JSON. Never execute source.
- Show keys and one column per language, preserving empty strings, Unicode and ICU placeholders.
- Search keys and translated text; link known runtime consumers to their registered pages.
- Preserve source revision when navigating. Show missing translations and unavailable historical catalog data truthfully.
- Move existing English dictionaries into source resources, add real French dictionaries and register both with existing runtime. English remains the default.
- Reuse ExplorerFrame, ExplorerControls, HarnessGroup and shared tokens.
- Basic relevant tests/type/build/browser smoke only; full CLI/native suite deferred by user.
