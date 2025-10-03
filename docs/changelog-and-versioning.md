# Changelog & versioning

Tea Timer Card follows semantic versioning. Use this page to find release notes and understand what
changes to expect when updating.

## Version numbers

- **Major (`X.0.0`):** Reserved for breaking changes. The card is still in preview, so expect 0.x
  releases until the API stabilizes.
- **Minor (`0.Y.0`):** New features, presets, or configuration options that remain backward
  compatible.
- **Patch (`0.1.Z`):** Bug fixes and documentation updates with no new configuration surface.

## Release notes

All releases are documented in [`CHANGELOG.md`](../CHANGELOG.md). Each entry lists notable features,
bug fixes, and documentation updates.

## Preview builds

During active development, preview builds may be published to gather feedback. These builds keep the
same configuration surface as the upcoming release. Expect rapid iteration and report issues quickly
so they can be addressed before the final release.

## Staying up to date

- Subscribe to repository notifications or watch releases on GitHub.
- When updating through HACS, review the changelog entry before installing.
- Re-run `npm run build` after pulling new commits if you self-host the bundle.

## Rollback plan

If you encounter issues after updating:

1. Revert to the previous tag or commit in your deployment.
2. Restore the matching documentation version from your backup or the repository history.
3. Open an issue describing the regression so maintainers can address it in the next patch release.
