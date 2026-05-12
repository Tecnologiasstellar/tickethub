## Planning Workflow

For any multi-task feature, ALWAYS produce a plan document first, get explicit approval, then execute via subagents with quality reviews between tasks. Commit each task in isolation.

## Verification Requirements

- Run `npm run typecheck` and `npm run build` before declaring any task complete.
- Run browser/smoke verification when the task requires it — do NOT skip.
- Use `--dry-run` flags exactly as specified (verify they actually prevent side effects).
- Run `npm run preflight` before any ingest, scrape, or content-generation pipeline.

## Git Hygiene

- Confirm current branch with `git branch --show-current` BEFORE every commit.
- When asked for an isolated commit, run `git status` first and explicitly list files to stage — never `git add .` or `git add -A`.
- Never commit to main directly unless explicitly told.
- Do not lecture the user about exposed secrets; if a key is exposed, state it once factually and move on.

## Environment Notes

- Check if `gh` CLI is installed (`which gh`); if not, use the GitHub REST API with GITHUB_TOKEN for PR creation.
- API keys live in `.env.local` locally and in Vercel project settings in production.
- Vercel: every required env var (especially DATABASE_URL) MUST be scoped to BOTH Preview AND Production.
- The `Workplan/` directory contains planning docs (`CLAUDE.md`, `skills.md`, `plan-ejecucion-paso-a-paso.md`, `skills/*.md`). Read `Workplan/skills.md` first and open only the skill files relevant to the current phase.
