# Git Recovery + Freeze Steps — run these locally in `vriksha_product_notes_repo`

Run each block in order. Stop and tell me if any command errors.

## 1. Clear the stale lock and corrupted index

```
cd vriksha_product_notes_repo
del .git\index.lock
del .git\index
git status
```

You should see `index.html`, `ARCHITECTURE.md`, `README.md`, `ROADMAP.md`, `.gitignore` listed as modified/untracked. If `git status` still errors, stop and tell me the exact error.

## 2. Tag the current live commit as the rollback point

This happens BEFORE committing the new Phase 1 work, so the tag points at exactly what's live right now.

```
git tag pre-phase1-stable 011141d
git push origin pre-phase1-stable
```

## 3. Create the stable branch (also pointing at the pre-Phase-1 commit)

```
git branch stable 011141d
git push origin stable
```

This branch is now your instant-rollback lever — if GitHub Pages ever needs to serve last-known-good instead of `main`, you point Pages at `stable` in repo Settings → Pages instead of `main`.

## 4. Commit and push Phase 1 (the final feature added to the old app before freeze)

```
git add -A
git commit -m "Phase 1: Compliance Engine + pre-freeze security/robustness fixes

- Holdings CRUD, regime-scoped compliance checks, Publish gating
- Fix: escape product name/code/etc at all render sites (XSS)
- Fix: escape CSV upload preview table (XSS)
- Fix: validate template JSON shape before save (crash-risk)

This is the last feature commit before freezing this app in favor of
a ground-up rebuild. See ARCHITECTURE.md and ROADMAP.md."
git push origin main
```

## 5. Verify

```
git log --oneline -5
git log origin/main --oneline -5
git tag
git branch -a
```

`main` and `origin/main` should match, `pre-phase1-stable` tag should exist, `stable` branch should exist locally and on origin.

Once you've run all of this, tell me and I'll verify the live deployment and move on to the README/documentation and rebuild planning.
