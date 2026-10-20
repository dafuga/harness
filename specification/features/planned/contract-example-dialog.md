# Feature: Contract Example Dialog

## Overview

Read an entity's public contract as compact tables. Names, descriptions and types stay visible; examples open through an info icon in the existing shared modal.

## Acceptance Criteria

- Inputs and outputs use accessible tables; errors and config provisions keep their existing meaning.
- Each field exposes a named info button that opens its type and examples in a modal.
- Examples remain out of the closed table and clearly identify declared, illustrative or missing data.
- False, zero, null, empty strings, structured data and multiple examples retain their values. Markup is displayed as text.
- Escape and the shared Close action dismiss the modal and restore focus. The view fits desktop, tablet and phone widths.
- Branch and commit context, the dedicated Contract tab and Details compatibility are preserved.

## Verification

Extend the standardized entity contract component and responsive preview tests. Record their committed failing checkpoint before Opus changes the UI, then preserve the same passing tests at the fix commit.
