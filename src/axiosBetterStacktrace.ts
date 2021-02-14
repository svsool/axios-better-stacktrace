import { AxiosInstance, AxiosError, AxiosResponse } from 'axios';

const patchedSym = Symbol('axiosBetterStacktrace.patched');

declare module 'axios' {
  export interface AxiosRequestConfig {
    topmostError?: Error;
  }

  export interface AxiosError {
    originalStack?: string;
  }
}

type AxiosInstancePatched = AxiosInstance & {
  [patchedSym]?: boolean;
};

const isAxiosError = (error: unknown): error is AxiosError =>
  error instanceof Error && (error as AxiosError).isAxiosError !== undefined;

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

type HandlerParams =
  | {
      method: 'request';
      originalHandler: AxiosInstance['request'];
      args: Parameters<AxiosInstance['request']>;
    }
  | {
      method: 'get' | 'delete' | 'head' | 'options';
      // all methods above share the same handler signature
      originalHandler: AxiosInstance['get'];
      args: Parameters<AxiosInstance['get']>;
    }
  | {
      method: 'post' | 'put' | 'patch';
      // all methods above share the same handler signature
      originalHandler: AxiosInstance['post'];
      args: Parameters<AxiosInstance['post']>;
    };

// inherits original axios handler generics https://github.com/axios/axios/blob/79979d9214601478b67a330fc144cad25c59f3c7/index.d.ts#L139-L146
const axiosBetterStacktraceHandler = <T = any, R = AxiosResponse<T>>(
  params: HandlerParams,
  topmostError: Error,
): Promise<R> => {
  // extends request config with topmostError, so it could be used inside an interceptor to enhance original error
  switch (params.method) {
    case 'request': {
      const {
        originalHandler,
        args: [config],
      } = params;
      return originalHandler<T, R>({
        ...(config || {}),
        topmostError,
      });
    }
    case 'get':
    case 'delete':
    case 'head':
    case 'options': {
      const {
        originalHandler,
        args: [url, config],
      } = params;
      return originalHandler<T, R>(url, {
        ...(config || {}),
        topmostError,
      });
    }
    case 'post':
    case 'put':
    case 'patch': {
      const {
        originalHandler,
        args: [url, data, config],
      } = params;
      return originalHandler<T, R>(url, data, {
        ...(config || {}),
        topmostError,
      });
    }
  }
};

const axiosBetterStacktrace = (axiosInstance?: AxiosInstance, opts: { errorMsg?: string } = {}) => {
  const { errorMsg = 'Axios Better Stacktrace' } = opts;

  // do nothing if input does not look like an axios instance
  if (!axiosInstance || !axiosMethods.some((method) => axiosInstance.hasOwnProperty(method))) {
    return;
  }

  // avoid potential memory leaks if axios instance already patched
  if ((axiosInstance as AxiosInstancePatched)[patchedSym]) {
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

  // enhance original error with a topmostError stack trace
  axiosInstance.interceptors.response.use(undefined, (error: unknown) => {
    if (isAxiosError(error) && error.config && error.config.topmostError instanceof Error) {
      error.originalStack = error.stack;
      error.stack = `${error.stack}\n${error.config.topmostError.stack}`;

      // remove topmostError to not clutter config and expose it to other interceptors down the chain
      delete error.config.topmostError;

      throw error;
    }

    throw error;
  });

  axiosMethods.forEach((method) => {
    if (method in axiosInstance) {
      switch (method) {
        case 'request': {
          const originalHandler = axiosInstance[method];
          axiosInstance[method] = function axiosBetterStacktraceMethodProxy(config) {
            return axiosBetterStacktraceHandler(
              {
                method,
                originalHandler,
                args: [config],
              },
              new Error(errorMsg),
            );
          };
          break;
        }
        case 'get':
        case 'delete':
        case 'head':
        case 'options': {
          const originalHandler = axiosInstance[method];
          axiosInstance[method] = function axiosBetterStacktraceMethodProxy(url, config) {
            return axiosBetterStacktraceHandler(
              {
                method,
                originalHandler,
                args: [url, config],
              },
              new Error(errorMsg),
            );
          };
          break;
        }
        case 'post':
        case 'put':
        case 'patch': {
          const originalHandler = axiosInstance[method];
          axiosInstance[method] = function axiosBetterStacktraceMethodProxy(url, data, config) {
            return axiosBetterStacktraceHandler(
              {
                method,
                originalHandler,
                args: [url, data, config],
              },
              new Error(errorMsg),
            );
          };
          break;
        }
      }

      if (!(axiosInstance as AxiosInstancePatched)[patchedSym]) {
        (axiosInstance as AxiosInstancePatched)[patchedSym] = true;
      }
    }
  });

  // ensure consumer of the plugin can restore original handlers
  const restoreOriginalHandlers = () => {
    Object.assign(axiosInstance, originalHandlers);
  };

  return restoreOriginalHandlers;
};

export default axiosBetterStacktrace;
