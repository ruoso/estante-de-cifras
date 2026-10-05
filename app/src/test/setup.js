import '@testing-library/jest-dom/vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Every behavior test gets jest-dom's DOM matchers and the Vitest-native axe
// matcher (`toHaveNoViolations`) without per-file ceremony.
expect.extend(axeMatchers);

// Unmount React trees between tests so each renders into a clean document.
afterEach(() => cleanup());
