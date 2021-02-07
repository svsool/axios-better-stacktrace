import { AxiosInstance, AxiosResponse } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    topmostError?: Error;
  }
}

type ArgumentsType<T extends (...args: any[]) => any> = T extends (...args: infer A) => any
  ? A
  : never;

type EnhancedRequestError = Error & { originalStack: Error['stack'] };

type AxiosInstancePatched = AxiosInstance & {
  __axiosBetterStacktracePatched?: boolean;
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

type AxiosMethod = typeof axiosMethods[number];

type GenericAxiosHandler = <T = any, R = AxiosResponse<T>>(...args: any[]) => Promise<R>;

type PatchAxiosHandlerParams =
  | {
      method: 'request';
      originalHandler: AxiosInstance['request'];
      args: ArgumentsType<AxiosInstance['request']>;
    }
  | {
      method: 'get' | 'delete' | 'head' | 'options';
      // all methods share the same handler signature
      originalHandler: AxiosInstance['get'];
      args: ArgumentsType<AxiosInstance['get']>;
    }
  | {
      method: 'post' | 'put' | 'patch';
      // all methods share the same handler signature
      originalHandler: AxiosInstance['post'];
      args: ArgumentsType<AxiosInstance['post']>;
    };

const axiosBetterStacktraceHandler = (
  params: PatchAxiosHandlerParams,
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

  // extend axios original handlers with a catch block which augments original error with a better stack trace
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
  if ((axiosInstance as AxiosInstancePatched).__axiosBetterStacktracePatched) {
    return;
  }

  // ensure original handlers can be restored after patching
  const originalHandlersByMethod = axiosMethods.reduce((acc, method) => {
    if (method in axiosInstance) {
      acc[method] = axiosInstance[method];
    }

    return acc;
  }, {} as Record<AxiosMethod, GenericAxiosHandler>);

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

      if (!(axiosInstance as AxiosInstancePatched).__axiosBetterStacktracePatched) {
        (axiosInstance as AxiosInstancePatched).__axiosBetterStacktracePatched = true;
      }
    }
  });

  // ensure consumer of the plugin can restore original handlers
  const restoreOriginalHandlers = () => {
    Object.keys(originalHandlersByMethod).forEach((method) => {
      axiosInstance[method] = originalHandlersByMethod[method];
    });
  };

  return restoreOriginalHandlers;
};

export default axiosBetterStacktrace;
