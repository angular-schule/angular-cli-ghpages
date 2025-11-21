# Audit Request: Angular Builder Integration Tests

## What Was Added

**New Test File:** `src/parameter-tests/builder-integration.spec.ts`

**Purpose:** True integration tests for the Angular Builder execution path (`ng deploy`)

## Audit Questions

### 1. Are These TRUE Integration Tests?

**Claim:** These tests verify the COMPLETE flow from Angular Builder → Engine → Final Options

**Verify:**
- [ ] Does the test import the REAL `engine` module (not a mock)?
- [ ] Does the test import the REAL `deploy` function from `deploy/actions.ts`?
- [ ] Are ONLY external dependencies mocked (gh-pages, fs-extra)?
- [ ] Does the test execute the actual transformation logic in `engine.prepareOptions()`?

**How to check:**
```typescript
// Line 80-81: Are these the real imports?
import deploy from '../deploy/actions';
import * as engine from '../engine/engine';

// Line 95: Is this passing the REAL engine (not a mock)?
await deploy(engine, context, BUILD_TARGET, options);
```

### 2. Does Mocking Strategy Make Sense?

**Claim:** We mock external dependencies but NOT our internal code

**Verify:**
- [ ] Is `gh-pages` mocked? (Lines 24-39)
- [ ] Is `fs-extra` mocked? (Lines 57-77)
- [ ] Is `engine` NOT mocked?
- [ ] Is `deploy/actions` NOT mocked?

**Why this matters:**
- External deps (gh-pages, fs) = side effects we want to avoid
- Internal code (engine, deploy) = what we're testing

### 3. Are All Critical Parameters Tested?

**Claim:** All boolean negation transformations are verified in complete flow

**Verify:**
- [ ] Test: `noDotfiles: true` → `dotfiles: false` (Line 88-101)
- [ ] Test: `noNotfound: true` → `notfound: false` (Line 103-116)
- [ ] Test: `noNojekyll: true` → `nojekyll: false` (Line 118-131)
- [ ] Test: All three together (Line 133-153)
- [ ] Test: Default values when not specified (Line 155-167)

**Critical check:** Do tests verify BOTH:
1. The transformed property (`dotfiles: false`)
2. AND that the original property is still present (`noDotfiles: true`)

### 4. Are Tests Actually Running Real Code?

**How to verify:**

Run the tests and check they actually call the engine:

```bash
npm test -- builder-integration.spec.ts
```

**Add a console.log to `engine/engine.ts` line 83:**
```typescript
if (origOptions.noDotfiles) {
  console.log('AUDIT: Engine is transforming noDotfiles');
  options.dotfiles = !origOptions.noDotfiles;
}
```

**Run test again:**
```bash
npm test -- builder-integration.spec.ts 2>&1 | grep "AUDIT"
```

**Expected:** You should see "AUDIT: Engine is transforming noDotfiles"

**If you DON'T see it:** The test is NOT running real code!

### 5. Do Tests Capture Final Options Correctly?

**Claim:** We capture the exact options that would be passed to `gh-pages.publish()`

**Verify:**
- [ ] Check mock at lines 24-39: Does it capture options correctly?
- [ ] Check test assertions: Do they verify `capturedPublishOptions`?
- [ ] Run a test and add debug output to confirm options are captured

**How to verify:**
```typescript
// Add to beforeEach (line 86):
console.log('CAPTURED OPTIONS:', JSON.stringify(capturedPublishOptions, null, 2));
```

Run test and verify output shows the transformed options.

### 6. Are Tests Independent?

**Verify:**
- [ ] Does `beforeEach` reset `capturedPublishOptions = null`? (Line 84)
- [ ] Do tests not interfere with each other?
- [ ] Can tests run in any order?

**How to verify:**
```bash
# Run tests multiple times
npm test -- builder-integration.spec.ts
npm test -- builder-integration.spec.ts
npm test -- builder-integration.spec.ts
```

All runs should pass identically.

### 7. Do Tests Match Reality?

**Critical question:** Do the integration tests produce the same results as the CLI E2E tests?

**Compare:**

**CLI E2E test** (`cli-e2e.spec.ts` line 111-117):
```typescript
it('should handle --no-dotfiles flag', () => {
  const output = runCli('--no-dotfiles');
  const json = parseJsonFromCliOutput(output);
  expect(json.dotfiles).toBe("files starting with dot ('.') will be ignored");
});
```

**Builder Integration test** (`builder-integration.spec.ts` line 88-101):
```typescript
it('should transform noDotfiles: true to dotfiles: false in complete flow', async () => {
  const options: Schema = {
    repo: 'https://github.com/test/repo.git',
    noDotfiles: true,
    noBuild: true
  };

  await deploy(engine, context, BUILD_TARGET, options);

  expect(capturedPublishOptions).not.toBeNull();
  expect(capturedPublishOptions.dotfiles).toBe(false);
});
```

**Verify:**
- [ ] Both tests verify `dotfiles` property
- [ ] CLI test checks dry-run output message
- [ ] Integration test checks actual option value
- [ ] Both should produce equivalent results (CLI shows message, Integration shows value)

### 8. Code Coverage Question

**Does this test file increase coverage?**

Compare test coverage before and after:

```bash
# Check what these tests actually execute
npm test -- builder-integration.spec.ts --coverage --collectCoverageFrom='src/engine/**/*.ts' --collectCoverageFrom='src/deploy/**/*.ts'
```

**Verify:**
- [ ] Does coverage report show `engine.ts` is executed?
- [ ] Does coverage report show `prepareOptions()` is executed?
- [ ] Are the transformation lines (79-91) covered?

## Expected Audit Results

### ✅ PASS Criteria

1. Tests use REAL engine and deploy/actions (not mocked)
2. Tests execute REAL transformation logic
3. Only external dependencies are mocked
4. All critical boolean negation parameters tested
5. Tests verify complete flow from input → transformation → final output
6. Tests are independent and repeatable
7. Adding console.log to engine shows it's being called
8. Coverage report confirms engine code is executed

### ❌ FAIL Criteria

1. Engine or deploy/actions are mocked
2. Transformation logic is bypassed
3. Tests don't actually call `prepareOptions()`
4. Missing critical parameter tests
5. Tests share state or aren't independent
6. Adding console.log to engine shows nothing (not being called)

## How to Run This Audit

```bash
cd src

# 1. Run tests to verify they pass
npm test -- builder-integration.spec.ts

# 2. Add debug output to engine/engine.ts (line 83)
# Add: console.log('AUDIT: Transforming noDotfiles =', origOptions.noDotfiles);

# 3. Run tests again to see debug output
npm test -- builder-integration.spec.ts 2>&1 | grep "AUDIT"

# 4. Check coverage
npm test -- builder-integration.spec.ts --coverage

# 5. Remove debug output from engine.ts

# 6. Verify all tests still pass
npm test
```

## Questions for Auditor

1. **Are these true integration tests or disguised unit tests?**

2. **Is our mocking strategy correct?** (Mock externals, not internals)

3. **Do these tests prove that Angular Builder and CLI paths work identically?**

4. **Are we missing any critical test cases?**

5. **Is there a better way to verify integration without mocking?**

## Auditor Sign-Off

**Auditor:** _____________________

**Date:** _____________________

**Result:** [ ] PASS / [ ] FAIL / [ ] NEEDS IMPROVEMENT

**Comments:**

---
---
---

**Findings:**

**Recommendations:**
