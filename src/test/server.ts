import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Shared MSW server for tests (lifecycle wired in src/test/setup.ts). */
export const server = setupServer(...handlers);
