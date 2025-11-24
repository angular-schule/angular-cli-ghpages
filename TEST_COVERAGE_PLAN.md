# Test Coverage & Refactoring Plan

## Objectives
1. **Add critical missing tests** (silent failures, monkeypatch, real filesystem)
2. **Refactor prepareOptions()** to enable intensive testing of each option
3. **Export public types** for user extensibility
4. **Complete gh-pages behavioral tests** (engine.gh-pages-behavior.spec.ts) for v6 upgrade preparation

---

## Phase 1: Critical Test Gaps (High Priority)

### 1.1 gh-pages Error Callback Tests
**File:** `src/engine/engine.spec.ts`

Add tests for the "do NOT await" error handling:
- Test: gh-pages.publish calls callback with error → promise rejects
- Test: Error message is preserved through rejection
- Test: Multiple error types (git push failed, auth failed, etc.)

**Why Critical:** Verifies we never fall into silent failure trap

### 1.2 Monkeypatch Verification Tests
**File:** `src/engine/engine.spec.ts` (new describe block)

Add comprehensive monkeypatch tests:
- Test: util.debuglog is replaced after prepareOptions()
- Test: debuglog('gh-pages') calls forward to logger.info()
- Test: debuglog('other-module') calls original implementation
- Test: Message formatting (util.format with %s, %d args)
- Test: Order dependency - monkeypatch happens before gh-pages require

**Why Critical:** ZERO coverage for critical interception logic

### 1.3 Real Filesystem Tests
**File:** `src/engine/engine-filesystem.spec.ts` (NEW FILE)

Tests using real temp directories:
- Test: .nojekyll file created with empty content
- Test: CNAME file created with correct domain content
- Test: 404.html is exact copy of index.html
- Test: Files NOT created when dry-run=true
- Test: CNAME write failure throws error with correct message
- Test: .nojekyll write failure throws error
- Test: 404.html copy fails gracefully (no index.html) - warns, continues
- Test: Cleanup temp directory after each test

**Pattern:** Use `os.tmpdir()` + unique folder per test

---

## Phase 2: Refactor prepareOptions() + Intensive Tests

### 2.1 Extract Functions from prepareOptions()
**File:** `src/engine/engine.ts`

Current prepareOptions() does 8 things (206 lines):
1. Merge defaults with user options
2. Setup monkeypatch
3. Map negated boolean options (noDotfiles → dotfiles)
4. Validate and combine user credentials
5. Append CI environment metadata to messages
6. Discover remote URL
7. Inject authentication tokens
8. Warn about deprecated parameters

**Refactor to:**
```typescript
// Keep as orchestrator
export async function prepareOptions(origOptions: Schema, logger: logging.LoggerApi): Promise<PreparedOptions> {
  const options = mergeOptionsWithDefaults(origOptions);
  setupMonkeypatch(logger);
  mapNegatedBooleans(options, origOptions);
  handleUserCredentials(options, origOptions, logger);
  appendCIMetadata(options);
  await discoverAndInjectRemoteUrl(options);
  warnDeprecatedParameters(origOptions, logger);
  return options;
}

// NEW: Extracted, testable functions
function mergeOptionsWithDefaults(origOptions: Schema): PreparedOptions
function mapNegatedBooleans(options: PreparedOptions, origOptions: Schema): void
function handleUserCredentials(options: PreparedOptions, origOptions: Schema, logger: LoggerApi): void
function appendCIMetadata(options: PreparedOptions): void
async function discoverAndInjectRemoteUrl(options: PreparedOptions): Promise<void>
function injectToken(repoUrl: string, token: string): string
function warnDeprecatedParameters(origOptions: Schema, logger: LoggerApi): void
```

### 2.2 Intensive Tests for Each Function
**File:** `src/engine/prepare-options.spec.ts` (NEW FILE)

Test EVERY extracted function intensively:

**mergeOptionsWithDefaults:**
- All 15 default values applied when not specified
- User values override defaults
- Partial options object works

**mapNegatedBooleans:**
- noDotfiles: true → dotfiles: false
- noDotfiles: false → dotfiles: true
- noDotfiles: undefined → dotfiles: true (default)
- Same pattern for noNotfound, noNojekyll

**handleUserCredentials:**
- Both name + email → creates user object
- Only name → warning, no user object
- Only email → warning, no user object
- Neither → no warning, no user object

**appendCIMetadata:**
- Travis CI: Adds commit message, build URL, repo slug
- CircleCI: Adds commit SHA, build URL, username/repo
- GitHub Actions: Adds commit SHA, repository
- No CI env: Message unchanged
- Multiple CI envs: All metadata appended

**injectToken:**
- GH_TOKEN: Injects x-access-token
- PERSONAL_TOKEN: Injects x-access-token
- GITHUB_TOKEN: Injects x-access-token
- Legacy GH_TOKEN placeholder replacement
- Token already present: No double injection
- SSH URL: No injection
- No token env var: URL unchanged
- Token with special chars: Properly encoded

**warnDeprecatedParameters:**
- noSilent: true → warning logged
- noSilent: false → warning logged
- noSilent: undefined → no warning

**Coverage Goal:** 100% of prepareOptions logic tested

---

## Phase 3: Export Public Types

### 3.1 Create Public API
**File:** `src/index.ts` (NEW FILE)

```typescript
// Public API for users extending angular-cli-ghpages
export { Schema } from './deploy/schema';
export { GHPages, PublishOptions, DeployUser } from './interfaces';
export { run as deploy } from './engine/engine';
export { defaults } from './engine/defaults';

// Advanced: For custom builders
export { deploy as deployAction } from './deploy/actions';
```

### 3.2 Update package.json
Add `"types": "index.d.ts"` to package.json

### 3.3 Test Public API
**File:** `src/public-api.spec.ts` (NEW FILE)

- Test: All exports are defined
- Test: Types can be imported by consumers
- Test: Example usage compiles

---

## Phase 4: Upgrade Readiness & Remaining Gaps

### 4.1 Intensive Tests for gh-pages/lib/git Usage
**File:** `src/engine/engine.prepare-options-helpers.spec.ts` (add new tests)

✅ **COMPLETED:** Added 6 comprehensive tests for getRemoteUrl() internal API dependency:
- ✅ Test: getRemoteUrl() returns correct URL from git config
- ✅ Test: Error when not in a git repository
- ✅ Test: Error when remote doesn't exist
- ✅ Test: Works when remote is provided from defaults
- ✅ Test: Returns consistent URL for same remote
- ✅ Test: Passes remote option to gh-pages getRemoteUrl method
- ✅ Note: No default fallback needed - prepareOptions() merges defaults.remote='origin'

**Why Critical:** This internal API could break in gh-pages v6+ upgrade

### 4.2 Complete gh-pages Behavioral Tests

✅ **COMPLETED:** Enhanced dotfiles tests in `engine.gh-pages-behavior.spec.ts`:
- ✅ Test: Verify files array INCLUDES .htaccess when dotfiles: true
- ✅ Test: Verify files array EXCLUDES .htaccess when dotfiles: false
- ✅ Test: Assert on exact file counts (4 files vs 3 files)
- ✅ Test: Assert on all individual file names in the list
- ✅ Fixed: Tests now actually verify file list differences, not just that copy was called

All behavioral tests for gh-pages v3.2.3 are now complete and provide comprehensive baseline for v6 upgrade.

---

## Implementation Order

### Sprint 1: Critical Tests (Day 1-2)
1. ✅ gh-pages error callback tests
2. ✅ Monkeypatch verification tests
3. ✅ Real filesystem tests

### Sprint 2: Refactor + Intensive Tests (Day 3-5)
4. ✅ Extract functions from prepareOptions
5. ✅ Add intensive tests for each extracted function
6. ✅ Verify all 213 existing tests still pass
7. ✅ Verify test coverage increases significantly

### Sprint 3: Public API + Behavioral Tests (Day 6-7)
8. ✅ Create and test public API exports
9. ✅ Comprehensive behavioral tests in engine.gh-pages-behavior.spec.ts (gh-pages-shell.spec.ts deleted - was unused infrastructure)
10. ✅ Document v3 baseline behavior

---

## Success Criteria

- **Test Count:** 213 → 351 tests (comprehensive suite, see test files for current count)
- **Coverage:** ✅ All critical paths tested (error callbacks, monkeypatch, file creation, getRemoteUrl, dotfiles)
- **Refactoring:** ✅ prepareOptions split into 6 testable functions
- **Public API:** ✅ Types exported via public_api.ts, TypeScript declarations enabled
- **Upgrade Prep:** ✅ v3 git behavior documented in engine.gh-pages-behavior.spec.ts
- **gh-pages/lib/git:** ✅ Internal API dependency intensively tested (3 focused tests verifying correctness)
- **Dotfiles:** ✅ Tests verify actual file list differences (4 files with dotfiles, 3 without)
- **Quality:** ✅ Zero regressions, all tests passing, zero 'any' types (HARD RULE compliant)
- **Test Safety:** ✅ process.env properly preserved (PATH, HOME, etc.) across all test files

---

## Files to Create/Modify

**New Files:**
- ✅ `src/engine/engine-filesystem.spec.ts` (real FS tests)
- ✅ `src/engine/engine.prepare-options-helpers.spec.ts` (intensive option tests)
- ✅ `src/engine/engine.gh-pages-behavior.spec.ts` (gh-pages v3 behavioral snapshot)
- ✅ `src/engine/engine.gh-pages-integration.spec.ts` (gh-pages option pass-through)
- ✅ `src/index.ts` (public API)
- ✅ `src/public_api.ts` (public API exports)
- ✅ `src/public-api.spec.ts` (API tests)
- ✅ `src/parameter-tests/pr-186-commander-defaults.spec.ts` (commander v3 compatibility)

**Modified Files:**
- ✅ `src/engine/engine.ts` (refactored prepareOptions into 6 functions)
- ✅ `src/engine/engine.spec.ts` (added error + monkeypatch tests)
- ✅ `src/engine/engine.prepare-options-helpers.ts` (documented gh-pages/lib/git internal dependency risk)
- ✅ `src/package.json` (added types field)
- ✅ `src/tsconfig.build.json` (enabled declaration: true)
- ✅ `src/interfaces.ts` (all types exportable)

**Deleted Files:**
- ✅ `src/parameter-tests/gh-pages-shell.spec.ts` (unused infrastructure, replaced by engine.gh-pages-behavior.spec.ts)

**Estimated:** ~8 files created/modified, ~110 new tests added

---

## Context: Why This Plan

This plan addresses critical findings from:
1. **PR #186 Analysis** - Need robust tests before gh-pages v6 upgrade
2. **Audit Remediation** - Priorities 1-6 complete, now addressing test gaps
3. **User Request** - "intensively test the shit out of this" for prepareOptions
4. **Current Gaps** - Zero monkeypatch coverage, all file tests use mocks

The refactoring enables the intensive testing you requested while maintaining backward compatibility.
