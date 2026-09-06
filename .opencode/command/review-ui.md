---
description: Review frontend UI code against the Vercel Web Interface Guidelines (accessibility, focus, forms, animation, typography, content, performance, navigation, touch, dark mode). Fetches the latest rules first.
---

Review the specified frontend files against the Web Interface Guidelines.

1. Fetch the latest guidelines fresh:
   `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
2. Read the specified files (default: all of `frontend/src/**` if none given). Files: $ARGUMENTS
3. Apply all rules from the fetched content.
4. Output findings grouped by file in `file:line` format, terse and high-signal (VS Code clickable), with `✓ pass` for clean files.

Key categories to prioritize in this repo: form controls need `<label>`, icon/action buttons need `aria-label`, no `outline: none`, `transition: all` forbidden, `…` over `...`, loading states end with `…`, tabular numbers for money columns, destructive actions need a confirmation dialog, `prefers-reduced-motion`, and no hardcoded date/number formats (use `Intl.*`).