# Testing Documentation

This folder documents test strategy, test data, E2E flows, and CI quality gates.

## Contents

- [documentation/specifications/10-testing/testing-strategy.md](../specifications/10-testing/testing-strategy.md) - Testing strategy

## Current Baseline

- Backend schema regression tests cover auth, assessment, and configuration validation contracts.
- Backend Jest is configured without Watchman to keep test execution portable across local and CI environments.
- Backend scoring engine tests cover formula outputs, thresholds, rounding, clamping, and stored-score fallback behavior.
