import axios from 'axios';
import nock from 'nock';

import axiosBetterStacktrace from './axiosBetterStacktrace';

const AGENT_BASE_URL = 'http://localhost:9000';

describe('axiosBetterStacktrace()', () => {
  beforeEach(() => {
    if (!nock.isActive()) {
      nock.disableNetConnect();
      nock.activate();
    }
  });

  afterEach(() => {
    if (!nock.isDone()) {
      const pendingMocks = nock.pendingMocks();

      nock.cleanAll();
      nock.restore();

      throw new Error(
        `Not all nock interceptors were used!\n${pendingMocks.map((n) => `=> ${n}`).join('\n')}`,
      );
    }

    nock.cleanAll();
    nock.restore();
  });

  it('does not fail when passed with undefined', () => {
    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    expect(() => axiosBetterStacktrace(agent)).not.toThrow();
  });

  it('should throw an original axios error', async () => {
    nock(AGENT_BASE_URL)
      .patch(/test-endpoint/)
      .reply(500, 'Internal Server Error');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    try {
      await agent.patch('/test-endpoint');

      throw new Error(
        'Execution should not reach to this point and raise an error inside an axios handler above',
      );
    } catch (err) {
      expect(err.stack).toContain('Error: Request failed with status code 500');
      expect(err.stack).toContain('node_modules/axios/lib/core/createError');
      expect(err.stack).not.toContain('Error: Axios Better Stacktrace');
    }
  });

  it('should throw an axios error with a better stacktrace', async () => {
    nock(AGENT_BASE_URL)
      .patch(/test-endpoint/)
      .reply(500, 'Internal Server Error');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    try {
      await agent.patch('/test-endpoint');

      throw new Error(
        'Execution should not reach to this point and raise an error inside an axios handler above',
      );
    } catch (err) {
      expect(err.stack).toContain('Error: Request failed with status code 500');
      expect(err.stack).toContain('node_modules/axios/lib/core/createError');

      expect(err.stack).toContain('Error: Axios Better Stacktrace');
      expect(err.stack).toContain('at Function.axiosBetterStacktraceMethodProxy [as patch]');
      expect(err.stack).toContain('axiosBetterStacktrace.spec.ts');
    }
  });

  it('should restore original handlers', () => {
    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    const originalRequestHandler = agent.request;
    const originalPostHandler = agent.post;
    const originalDeleteHandler = agent.delete;

    const restore = axiosBetterStacktrace(agent);

    expect(restore).toBeInstanceOf(Function);

    expect(agent.request).not.toBe(originalRequestHandler);
    expect(agent.post).not.toBe(originalPostHandler);
    expect(agent.delete).not.toBe(originalPostHandler);

    restore && restore();

    expect(agent.request).toBe(originalRequestHandler);
    expect(agent.post).toBe(originalPostHandler);
    expect(agent.delete).toBe(originalDeleteHandler);
  });

  it('should return undefined if axios instance already patched', () => {
    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    expect(axiosBetterStacktrace(agent)).toBeUndefined();
  });
});
