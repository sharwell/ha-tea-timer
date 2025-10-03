# Contributing & support

We welcome bug reports, documentation updates, and ideas to improve Tea Timer Card. Use the
following channels depending on what you need.

## Ask a question or get help

1. Search existing issues to see if your question has already been answered.
2. Open a new issue with the **Question** template. Include:
   - Home Assistant version and installation method.
   - Browser and device details.
   - Card configuration snippet (redact personal data).
   - Steps to reproduce the issue.
3. For automation-specific questions, include the relevant YAML and logs from **Settings → System →
   Logs** if available.

## Report a bug

1. Verify the issue still occurs on the latest release (check the
   [Changelog](changelog-and-versioning.md)).
2. Gather reproduction steps, screenshots (with alt text if you share them), and browser console
   errors.
3. Open an issue labeled **bug** and provide the details above.

## Contribute changes

1. Fork the repository and create a feature branch.
2. Install dependencies and run the local checks:

   ```bash
   npm ci
   npm run lint
   npm run typecheck
   npm test
   npm run docs:check
   ```

3. Update or add documentation as needed—especially when adding new options or user flows.
4. Submit a pull request describing your change, tests performed, and any follow-up work.

## Documentation improvements

- Found a typo or missing section? Open an issue or submit a pull request with the fix.
- When adding screenshots, include concise alt text so the docs remain accessible.
- If you add new pages under `docs/`, remember to update the README **Documentation** section.

## Release cadence

Releases use semantic versioning (`major.minor.patch`). Preview builds may be published for testing
before a feature lands in stable. See [Changelog & versioning](changelog-and-versioning.md) for the
latest release notes.

## Need direct support?

Community support happens publicly through GitHub issues to keep solutions discoverable. Sensitive
security reports can be sent privately to the maintainer via the email listed in `package.json`.
