import axios, { AxiosRequestConfig } from 'axios';
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

    try {
      await agent.patch('/test-endpoint');

      throw new Error(
        'Execution should not reach to this point and raise an error inside an axios handler above',
      );
    } catch (err) {
      [util.inspect(err), err.stack].forEach((errOrStack) => {
        expect(errOrStack).toContain('Error: Request failed with status code 500');
        expect(errOrStack).toContain('node_modules/axios/lib/core/createError');
        expect(errOrStack).not.toContain('Error: Axios Better Stacktrace');
      });
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
      [util.inspect(err), err.stack].forEach((errOrStack) => {
        expect(errOrStack).toContain('Error: Request failed with status code 500');
        expect(errOrStack).toContain('node_modules/axios/lib/core/createError');

        expect(errOrStack).toContain('Error: Axios Better Stacktrace');
        expect(errOrStack).toContain('at Function.axiosBetterStacktraceMethodProxy [as patch]');
        expect(errOrStack).toContain('axiosBetterStacktrace.spec.ts');
      });
    }
  });

  it('should retain original stack trace at error.originalStack', async () => {
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
      expect(err.originalStack).toContain('Error: Request failed with status code 500');
      expect(err.originalStack).toContain('node_modules/axios/lib/core/createError');
      expect(err.originalStack).not.toContain('Error: Axios Better Stacktrace');
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

  it('should not expose topmostError when exposeTopmostErrorViaConfig = false', async () => {
    nock(AGENT_BASE_URL)
      .patch(/test-endpoint/)
      .reply(500, 'Internal Server Error');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent, { exposeTopmostErrorViaConfig: false });

    let config: AxiosRequestConfig | undefined;

    agent.interceptors.response.use(undefined, (error) => {
      config = error.config;
    });

    await agent.patch('/test-endpoint', { greeting: 'Hello World!' });

    expect(config?.topmostError).toBeUndefined();
  });

  it('should merge config properly when exposeTopmostErrorViaConfig = true', async () => {
    nock(AGENT_BASE_URL)
      .get(/test-endpoint/)
      .reply(200, 'ok');
    nock(AGENT_BASE_URL)
      .get(/test-endpoint/)
      .reply(200, 'ok');
    nock(AGENT_BASE_URL)
      .post(/test-endpoint/)
      .reply(200, 'ok');

    const agent = axios.create({ baseURL: AGENT_BASE_URL });

    axiosBetterStacktrace(agent, { exposeTopmostErrorViaConfig: true });

    const requestConfig = {
      url: '/test-endpoint',
      data: { greeting: 'Hello World!' },
      timeout: 1000,
    };

    const { config: config1 } = await agent.request(requestConfig);

    expect(config1?.topmostError).toBeDefined();
    expect(config1).toMatchObject({
      ...requestConfig,
      data: JSON.stringify(requestConfig.data),
    });

    const { config: config2 } = await agent.get('/test-endpoint', { timeout: 1000 });

    expect(config2?.topmostError).toBeDefined();
    expect(config2?.timeout).toEqual(1000);

    const { config: config3 } = await agent.post(
      '/test-endpoint',
      { greeting: 'Hello World!' },
      { timeout: 1000 },
    );

    expect(config3?.topmostError).toBeDefined();
    expect(config3?.timeout).toEqual(1000);
  });

  describe('with exposeTopmostErrorViaConfig = true and request interceptor', () => {
    it('should expose topmostError via request.config', async () => {
      nock(AGENT_BASE_URL)
        .get(/test-endpoint/)
        .reply(200, 'ok');

      const agent = axios.create({ baseURL: AGENT_BASE_URL });

      axiosBetterStacktrace(agent, { exposeTopmostErrorViaConfig: true });

      let config: AxiosRequestConfig | undefined;

      agent.interceptors.request.use((configParam) => {
        config = configParam;

        return config;
      });

      await agent.request({
        url: '/test-endpoint',
      });

      [util.inspect(config?.topmostError), config?.topmostError?.stack].forEach((errOrStack) => {
        expect(errOrStack).toContain('Error: Axios Better Stacktrace');
        expect(errOrStack).toContain('at Function.axiosBetterStacktraceMethodProxy [as request]');
        expect(errOrStack).toContain('axiosBetterStacktrace.spec.ts');
      });
    });
  });

  describe('with exposeTopmostErrorViaConfig = true and response interceptor', () => {
    it('should expose topmostError via response.config', async () => {
      nock(AGENT_BASE_URL)
        .get(/test-endpoint/)
        .reply(200, 'ok');

      const agent = axios.create({ baseURL: AGENT_BASE_URL });

      axiosBetterStacktrace(agent, { exposeTopmostErrorViaConfig: true });

      let config: AxiosRequestConfig | undefined;

      agent.interceptors.response.use((response) => {
        config = response.config;

        return response;
      });

      await agent.get('/test-endpoint');

      [util.inspect(config?.topmostError), config?.topmostError?.stack].forEach((errOrStack) => {
        expect(errOrStack).toContain('Error: Axios Better Stacktrace');
        expect(errOrStack).toContain('at Function.axiosBetterStacktraceMethodProxy [as get]');
        expect(errOrStack).toContain('axiosBetterStacktrace.spec.ts');
      });
    });

    it('should expose topmostError via error.config', async () => {
      nock(AGENT_BASE_URL)
        .patch(/test-endpoint/)
        .reply(500, 'Internal Server Error');

      const agent = axios.create({ baseURL: AGENT_BASE_URL });

      axiosBetterStacktrace(agent, { exposeTopmostErrorViaConfig: true });

      let config: AxiosRequestConfig | undefined;

      agent.interceptors.response.use(undefined, (error) => {
        config = error.config;
      });

      await agent.patch('/test-endpoint', { greeting: 'Hello World!' });

      [util.inspect(config?.topmostError), config?.topmostError?.stack].forEach((errOrStack) => {
        expect(errOrStack).toContain('Error: Axios Better Stacktrace');
        expect(errOrStack).toContain('at Function.axiosBetterStacktraceMethodProxy [as patch]');
        expect(errOrStack).toContain('axiosBetterStacktrace.spec.ts');
      });
    });
  });
});
