# Changelog

All notable changes to `@three-ws/x402-modal` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-06-30

### Changed
- Renamed the published package from `@nirholas/x402-modal` to
  `@three-ws/x402-modal`; all install snippets, CDN URLs, and docs updated to the
  new scope.
- Licensing switched to proprietary — Copyright 2026 nirholas, all rights
  reserved. See [LICENSE](LICENSE); `package.json` declares
  `"license": "SEE LICENSE IN LICENSE"`.

## [0.2.0] - 2026-06-30

### Added
- Comprehensive documentation: README (CDN + npm install, sub-60s quickstart,
  discover→connect→sign→settle sequence diagram, full API reference, configuration
  and `data-*` attribute reference, Vanilla/React/CDN framework guides, theming
  hooks, security, FAQ), plus `docs/EXAMPLES.md` (9 runnable recipes), updated
  `docs/CONFIGURATION.md` / `docs/BACKEND.md`, and `CONTRIBUTING.md`.

### Changed
- Published as `@three-ws/x402-modal`. Defaults are now vendor-neutral: the `brand`
  footer link and `builderCode` attribution default to `null` (off) until a host
  opts in. The modal settles a 402 from any origin with zero configuration; USDC
  is the default settlement asset.
- The build banner is derived from package metadata (no hardcoded host/branding).

[0.2.1]: https://github.com/nirholas/x402-modal/releases/tag/v0.2.1
[0.2.0]: https://github.com/nirholas/x402-modal/releases/tag/v0.2.0
