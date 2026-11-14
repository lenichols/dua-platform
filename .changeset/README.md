# Changesets

Dua is a single, continuously deployed application, so changesets are used for
release notes and version numbers rather than package publishing.

Add one when a change is user-visible or operationally significant:

```bash
npm run changeset
```

Pick `patch`, `minor` or `major`, write a short summary in the user's language,
and commit the generated Markdown file with the change.

Maintainers cut a release from `production`:

```bash
npm run version-packages   # writes CHANGELOG.md and bumps package.json
git commit -am "chore(release): vX.Y.Z"
git tag vX.Y.Z
git push origin production --follow-tags
```

CI, docs, tests and internal refactors do not need a changeset.
