type EnhancedRequestError = Error & { originalStack: Error['stack'] };

type AxiosLikeInstance = {
  post: Function;
  put: Function;
  patch: Function;
  delete: Function;
  get: Function;
  head: Function;
  options: Function;
  request: Function;
};

type AxiosLikeInstancePatched = AxiosLikeInstance & {
  __axiosBetterStacktracePatched?: boolean;
};

const axiosMethods = [
  'post',
  'put',
  'patch',
  'delete',
  'get',
  'head',
  'options',
  'request',
] as const;

type AxiosMethod = typeof axiosMethods[number];

const axiosBetterStacktrace = (axiosInstance?: AxiosLikeInstance) => {
  // do nothing if input does not look like an axios instance
  if (!axiosInstance || !axiosMethods.some((method) => axiosInstance.hasOwnProperty(method))) {
    return;
  }

  // avoid potential memory leaks if axios instance already patched
  if ((axiosInstance as AxiosLikeInstancePatched).__axiosBetterStacktracePatched) {
    return;
  }

  // ensure original handlers can be restored after patching
  const originalHandlersByMethod = axiosMethods.reduce((acc, method) => {
    if (method in axiosInstance) {
      acc[method] = axiosInstance[method];
    }

    return acc;
  }, {} as Record<AxiosMethod, Function>);

  // extend axios original handlers with a catch block which augments original error with a better stack trace
  axiosMethods.forEach((method) => {
    if (method in axiosInstance) {
      const methodHandler = axiosInstance[method];

      axiosInstance[method] = function axiosBetterStacktraceMethodProxy(...args: unknown[]) {
        // obtain handler's stack trace at the topmost level possible
        // to provide more details than the original error
        const { stack: topmostStack } = new Error('Axios Better Stacktrace');

        const handlerResult = methodHandler(...args);

        return handlerResult.catch((maybeError: unknown) => {
          if (maybeError instanceof Error) {
            const error = maybeError as EnhancedRequestError;

            error.originalStack = maybeError.stack;
            error.stack = `${error.stack}\n${topmostStack}`;

            throw error;
          }

          return maybeError;
        });
      };

      if (!(axiosInstance as AxiosLikeInstancePatched).__axiosBetterStacktracePatched) {
        (axiosInstance as AxiosLikeInstancePatched).__axiosBetterStacktracePatched = true;
      }
    }
  });

  // ensure consumer of the plugin can restore original handlers
  const restoreOriginalHandlers = () => {
    Object.keys(originalHandlersByMethod).forEach((method) => {
      axiosInstance[method as AxiosMethod] = originalHandlersByMethod[method as AxiosMethod];
    });
  };

  return restoreOriginalHandlers;
};

export default axiosBetterStacktrace;
