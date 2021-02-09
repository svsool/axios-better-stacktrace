import { AxiosInstance } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    topmostError?: Error;
  }
}

type EnhancedRequestError = Error & { originalStack: Error['stack'] };

const patchedSym = Symbol('axiosBetterStacktrace.patched');

type AxiosInstancePatched = AxiosInstance & {
  [patchedSym]?: boolean;
};

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

const axiosBetterStacktraceHandler = (
  params: HandlerParams,
  topmostError: Error,
  exposeTopmostErrorViaConfig: boolean,
) => {
  // extend config with topmostError which can be used
  // inside interceptor callbacks (e.g. for logging purposes)
  const handlerResult = (() => {
    switch (params.method) {
      case 'request': {
        const {
          originalHandler,
          args: [config],
        } = params;
        return originalHandler(
          exposeTopmostErrorViaConfig
            ? {
                ...(config || {}),
                topmostError,
              }
            : config,
        );
      }
      case 'get':
      case 'delete':
      case 'head':
      case 'options': {
        const {
          originalHandler,
          args: [url, config],
        } = params;
        return originalHandler(
          url,
          exposeTopmostErrorViaConfig
            ? {
                ...(config || {}),
                topmostError,
              }
            : config,
        );
      }
      case 'post':
      case 'put':
      case 'patch': {
        const {
          originalHandler,
          args: [url, data, config],
        } = params;
        return originalHandler(
          url,
          data,
          exposeTopmostErrorViaConfig
            ? {
                ...(config || {}),
                topmostError,
              }
            : config,
        );
      }
    }
  })();

  // add default catch block to augment original error with a topmostError stack trace automatically
  return handlerResult.catch((maybeError) => {
    if (maybeError instanceof Error) {
      const error = maybeError as EnhancedRequestError;

      error.originalStack = maybeError.stack;
      error.stack = `${error.stack}\n${topmostError.stack}`;

      throw error;
    }

    return maybeError;
  });
};

const axiosBetterStacktrace = (
  axiosInstance?: AxiosInstance,
  opts: { errorMsg?: string; exposeTopmostErrorViaConfig?: boolean } = {},
) => {
  const { errorMsg = 'Axios Better Stacktrace', exposeTopmostErrorViaConfig = false } = opts;

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
              exposeTopmostErrorViaConfig,
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
              exposeTopmostErrorViaConfig,
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
              exposeTopmostErrorViaConfig,
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
