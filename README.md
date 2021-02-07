# axios-better-stacktrace

Axios plugin that provides better stack traces for axios errors.

Check [this axios issue](https://github.com/axios/axios/issues/2387) for more details.

[![npm](https://img.shields.io/npm/v/axios-better-stacktrace.svg?label=npm%20package)](https://www.npmjs.com/package/axios-better-stacktrace)
[![npm](https://img.shields.io/npm/dt/axios-better-stacktrace.svg)](https://www.npmjs.com/package/axios-better-stacktrace)
[![ci](https://github.com/svsool/axios-better-stacktrace/workflows/CI/badge.svg?branch=main)](https://github.com/svsool/axios-better-stacktrace/actions?query=workflow%3ACI+branch%main)
[![npm](https://img.shields.io/npm/l/axios-better-stacktrace.svg)](https://choosealicense.com/licenses/mit)

## Installation

NPM
```bash
npm install axios-better-stacktrace
```

Yarn
```bash
yarn add axios-better-stacktrace
```

### Note

It was tested with `axios 0.21.0`.

## Usage

```js
// CommonJS
// const axiosBetterStacktrace = require('axios-better-stacktrace').default;

// ES6
import axiosBetterStacktrace from 'axios-better-stacktrace';

// Example 1

axiosBetterStacktrace(axiosAgent);

// response error will get an enhanced stack trace inside a catch block automatically
axios.get('https://npmjs.com/<not-found>/').catch(enhancedError => console.error(enhancedError));

// Example 2

// enhanced error can also be accessed inside an interceptor callback (e.g. for logging purposes)
axiosBetterStacktrace(axiosAgent, { exposeTopmostErrorViaConfig: true });

axios.interceptors.response.use(config => config, (result) => {
  console.error(result.config.topmostError);

  return result;
});

axios.get('https://npmjs.com/<not-found>/');
```

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| errorMsg | `String` | `Axios Better Stacktrace` | Error message to show next to the original one in the output. |
| exposeTopmostErrorViaConfig | `Boolean` | `false` | Whether to expose enhanced error as `config.topmostError`. See [this issue](https://github.com/svsool/axios-better-stacktrace/issues/1) for reference. |

## Example

Axios error without an axios-better-stacktrace plugin:

```
Error: Request failed with status code 500
  at createError (./node_modules/axios/lib/core/createError.js:16:15)
  at settle (./node_modules/axios/lib/core/settle.js:17:12)
  at IncomingMessage.handleStreamEnd (./node_modules/axios/lib/adapters/http.js:244:11)
  at IncomingMessage.emit (node:events:376:20)
  at endReadableNT (node:internal/streams/readable:1294:12)
  at processTicksAndRejections (node:internal/process/task_queues:80:21)
```

Axios error with an axios-better-stacktrace plugin:

```
Error: Request failed with status code 500
  at createError (./node_modules/axios/lib/core/createError.js:16:15)
  at settle (./node_modules/axios/lib/core/settle.js:17:12)
  at IncomingMessage.handleStreamEnd (./node_modules/axios/lib/adapters/http.js:244:11)
  at IncomingMessage.emit (node:events:376:20)
  at endReadableNT (node:internal/streams/readable:1294:12)
  at processTicksAndRejections (node:internal/process/task_queues:80:21)
Error: Axios Better Stacktrace
  at Function.axiosBetterStacktraceMethodProxy [as patch] (./src/axiosBetterStacktrace.ts:59:41)
  at ./src/axiosBetterStacktrace.spec.ts:51:19
  at step (./src/axiosBetterStacktrace.spec.ts:33:23)
  at Object.next (./src/axiosBetterStacktrace.spec.ts:14:53)
  at ./src/axiosBetterStacktrace.spec.ts:8:71
  at new Promise (<anonymous>)
  at Object.<anonymous>.__awaiter (./src/axiosBetterStacktrace.spec.ts:4:12)
  at Object.<anonymous> (./src/axiosBetterStacktrace.spec.ts:41:57)
  at Object.asyncJestTest (./node_modules/jest-jasmine2/build/jasmineAsyncInstall.js:106:37)
  at ./node_modules/jest-jasmine2/build/queueRunner.js:45:12
```
