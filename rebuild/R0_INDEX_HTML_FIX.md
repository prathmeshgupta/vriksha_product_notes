# Fix: frozen app's index.html was overwritten during R0 setup

## What happened

When the R0 scaffold was copied into the repo root via `robocopy rebuild\scaffold . /E /XD node_modules`, both the frozen app and the new Vite scaffold had a file called `index.html` — the frozen app's is its entire ~200KB single-file application; Vite's was a 370-byte entry-point stub. Robocopy silently overwrote the real one with the stub, and this got committed and pushed in the R0 commit (`216c8e8` on `rebuild`).

**Nothing was actually lost.** The `main` branch (the live, deployed app) was never touched — this only affected the `rebuild` branch. The frozen app's real `index.html` also still exists on the `stable` branch and the `pre-phase1-stable` tag. Separately, all product *data* lives in Supabase, not in this file, and was completely unaffected — verified directly against the database (10 products, all intact).

## The fix

Two parts, both already prepared and staged in your repo folder (via file sync, not git — you still need to commit them):

1. **`index.html` at the repo root has been restored** to the correct frozen-app content (206,835 bytes, copied directly from the `main` branch via `git show main:index.html`).
2. **The Vite scaffold's entry point has been renamed to `app.html`**, and `vite.config.ts` updated (`build.rollupOptions.input: 'app.html'`, `server.open: '/app.html'`) so Vite builds from `app.html` instead of `index.html`. This means the collision cannot happen again — the two apps now have distinctly named entry files, verified by a clean build in a sandbox test (`dist/app.html` generated correctly, not `dist/index.html`).

## Steps to apply (run locally)

```powershell
cd C:\Users\pratj\OneDrive\Documents\Prathmesh\Work\WM\Vriksha\vriksha_product_notes_repo
git status
```

You should see `index.html` and `vite.config.ts` as modified, and `app.html` as untracked/new. Confirm `index.html`'s size looks right before committing:

```powershell
(Get-Item index.html).Length
```

Should print `206835`. If it doesn't match, stop and tell me — don't commit.

Then verify the dev server and build both still work correctly with the renamed entry point:

```powershell
npm run dev
```

This should now open `http://localhost:5173/app.html` (not `/`) and show the Vite/React starter page — confirm that still works, then Ctrl+C.

```powershell
npm run build
```

Check the build output lists `dist/app.html`, not `dist/index.html`.

If both pass, commit and push:

```powershell
git add -A
git commit -m "Fix: restore frozen app's index.html (was overwritten by R0 robocopy), rename Vite entry to app.html to prevent recurrence"
git push origin rebuild
```

## Going forward

Any future file-copy step between the scaffold/rebuild work and the repo root should be checked for filename collisions with the frozen app's files first — `index.html` was the only one this time, but worth a quick `dir` comparison before any future bulk copy, rather than assuming no overlap.
