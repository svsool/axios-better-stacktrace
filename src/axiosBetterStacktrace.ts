import { AxiosInstance, AxiosError } from 'axios';

const patchedSym = Symbol('axiosBetterStacktrace.patched');

declare module 'axios' {
  export interface AxiosInstance {
    [patchedSym]?: boolean;
  }

  export interface AxiosRequestConfig {
    topmostError?: Error;
  }

  export interface AxiosError {
    originalStack?: string;
  }
}

const isAxiosError = (error: unknown): error is AxiosError =>
  error instanceof Error && (error as AxiosError).isAxiosError;

const axiosMethods = [
  'request',
  'get',
  'delete',
  'head',
  'options',
  'post',
  'put',
  'patch',
] as const;

const axiosBetterStacktrace = (axiosInstance?: AxiosInstance, opts: { errorMsg?: string } = {}) => {
  const { errorMsg = 'Axios Better Stacktrace' } = opts;

  // do nothing if input does not look like an axios instance
  if (!axiosInstance || !axiosMethods.some((method) => axiosInstance.hasOwnProperty(method))) {
    return;
  }

  // avoid potential memory leaks if axios instance already patched
  if (axiosInstance[patchedSym]) {
    return;
  }

  const originalHandlers = {
    request: axiosInstance['request'],
    get: axiosInstance['get'],
    delete: axiosInstance['delete'],
    head: axiosInstance['head'],
    options: axiosInstance['options'],
    post: axiosInstance['post'],
    put: axiosInstance['put'],
    patch: axiosInstance['patch'],
  };

  // enhance original response error with a topmostError stack trace
  const responseErrorInterceptorId = axiosInstance.interceptors.response.use(
    (response) => {
      if (response.config && response.config.topmostError instanceof Error) {
        // remove topmostError to not clutter config and expose it to other interceptors down the chain
        delete response.config.topmostError;
      }

      return response;
    },
    (error: unknown) => {
      if (isAxiosError(error) && error.config && error.config.topmostError instanceof Error) {
        error.originalStack = error.stack;
        error.stack = `${error.stack}\n${error.config.topmostError.stack}`;

        delete error.config.topmostError;

        throw error;
      }

      throw error;
    },
  );

  axiosMethods.forEach((method) => {
    if (method in axiosInstance) {
      switch (method) {
        case 'request': {
          const originalHandler = axiosInstance[method];
          axiosInstance[method] = function axiosBetterStacktraceMethodProxy(config) {
            return originalHandler({
              ...(config || {}),
              topmostError: new Error(errorMsg),
            });
          };
          break;
        }
        case 'get':
        case 'delete':
        case 'head':
        case 'options': {
          const originalHandler = axiosInstance[method];
          axiosInstance[method] = function axiosBetterStacktraceMethodProxy(url, config) {
            return originalHandler(url, {
              ...(config || {}),
              topmostError: new Error(errorMsg),
            });
          };
          break;
        }
        case 'post':
        case 'put':
        case 'patch': {
          const originalHandler = axiosInstance[method];
          axiosInstance[method] = function axiosBetterStacktraceMethodProxy(url, data, config) {
            return originalHandler(url, data, {
              ...(config || {}),
              topmostError: new Error(errorMsg),
            });
          };
          break;
        }
      }

      if (!axiosInstance[patchedSym]) {
        axiosInstance[patchedSym] = true;
      }
    }
  });

  // ensure consumer of the plugin can restore original handlers and remove custom interceptor
  return () => {
    axiosInstance.interceptors.response.eject(responseErrorInterceptorId);
    Object.assign(axiosInstance, originalHandlers);
  };
};

export = axiosBetterStacktrace;
