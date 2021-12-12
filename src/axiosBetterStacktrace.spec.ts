import axios, { AxiosError } from 'axios';
import nock from 'nock';
import util from 'util';

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

    expect.assertions(6);

    try {
      await agent.patch('/test-endpoint');

      throw new Error(
        'Execution should not reach to this point and raise an error inside an axios handler above',
      );
    } catch (err) {
      if (err instanceof Error) {
        [util.inspect(err), err.stack].forEach((errOrStack) => {
          expect(errOrStack).toContain('Error: Request failed with status code 500');
          expect(errOrStack).toContain('node_modules/axios/lib/core/createError');
          expect(errOrStack).not.toContain('Error: Axios Better Stacktrace');
        });
      }
    }
  });

  it('should throw an axios error with a better stacktrace', async () => {
    nock(AGENT_BASE_URL)
      .patch(/test-endpoint/)
      .reply(500, 'Internal Server Error');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    expect.assertions(10);

    try {
      await agent.patch('/test-endpoint');

      throw new Error(
        'Execution should not reach to this point and raise an error inside an axios handler above',
      );
    } catch (err) {
      if (err instanceof Error) {
        [util.inspect(err), err.stack].forEach((errOrStack) => {
          expect(errOrStack).toContain('Error: Request failed with status code 500');
          expect(errOrStack).toContain('node_modules/axios/lib/core/createError');

          expect(errOrStack).toContain('Error: Axios Better Stacktrace');
          expect(errOrStack).toContain('at Function.axiosBetterStacktraceMethodProxy [as patch]');
          expect(errOrStack).toContain('axiosBetterStacktrace.spec.ts');
        });
      }
    }
  });

  it('should retain original stack trace at error.originalStack', async () => {
    nock(AGENT_BASE_URL)
      .patch(/test-endpoint/)
      .reply(500, 'Internal Server Error');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    expect.assertions(3);

    try {
      await agent.patch('/test-endpoint');

      throw new Error(
        'Execution should not reach to this point and raise an error inside an axios handler above',
      );
    } catch (err) {
      const originalStack = (err as AxiosError).originalStack;

      expect(originalStack).toContain('Error: Request failed with status code 500');
      expect(originalStack).toContain('node_modules/axios/lib/core/createError');
      expect(originalStack).not.toContain('Error: Axios Better Stacktrace');
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

  it('should call interceptor eject upon restore', () => {
    const agent = axios.create({ baseURL: AGENT_BASE_URL });
    const ejectSpy = jest.spyOn(agent.interceptors.response, 'eject');
    const restore = axiosBetterStacktrace(agent);
    const expectedInterceptorId = 0;

    restore && restore();

    expect(ejectSpy).toHaveBeenCalledWith(expectedInterceptorId);
  });

  it('should return undefined if axios instance already patched', () => {
    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    expect(axiosBetterStacktrace(agent)).toBeUndefined();
  });

  it('should provide an axios error with a better stacktrace inside a response interceptor', async () => {
    nock(AGENT_BASE_URL)
      .patch(/test-endpoint/)
      .reply(500, 'Internal Server Error');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    let error: Error | undefined;

    agent.interceptors.response.use(undefined, (err) => {
      error = err;
    });

    await agent.patch('/test-endpoint', { greeting: 'Hello World!' });

    [util.inspect(error), error?.stack].forEach((errOrStack) => {
      expect(errOrStack).toContain('Error: Axios Better Stacktrace');
      expect(errOrStack).toContain('at Function.axiosBetterStacktraceMethodProxy [as patch]');
      expect(errOrStack).toContain('axiosBetterStacktrace.spec.ts');
    });
  });

  it('should remove topmostError from the config on response success', async () => {
    nock(AGENT_BASE_URL)
      .get(/test-endpoint/)
      .reply(200, 'All good!');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    const result = await agent.get('/test-endpoint');

    expect(result.config.topmostError).toBeUndefined();
  });

  it('should remove topmostError from the config on response error', async () => {
    nock(AGENT_BASE_URL)
      .patch(/test-endpoint/)
      .reply(500, 'Internal Server Error');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    expect.assertions(1);

    try {
      await agent.request({
        url: '/test-endpoint',
        method: 'patch',
      });

      throw new Error(
        'Execution should not reach to this point and raise an error inside an axios handler above',
      );
    } catch (error) {
      expect((error as AxiosError).config.topmostError).toBeUndefined();
    }
  });

  it('should proxy custom config parameters', async () => {
    nock(AGENT_BASE_URL)
      .delete(/test-endpoint/)
      .reply(200)
      .get(/test-endpoint/)
      .reply(200)
      .patch(/test-endpoint/)
      .reply(200);

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent);

    const customConfig = {
      timeout: 5000,
    };

    const responses = await Promise.all([
      await agent.request({
        url: '/test-endpoint',
        method: 'delete',
        ...customConfig,
      }),
      await agent.get('/test-endpoint', customConfig),
      await agent.patch('/test-endpoint', {}, customConfig),
    ]);

    expect(responses.map(({ config: { timeout } }) => timeout)).toEqual([5000, 5000, 5000]);
  });
});
