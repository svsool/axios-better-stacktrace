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

// use it before any other interceptors
axiosBetterStacktrace(axiosAgent);

// when using promises response error will get an enhanced stack trace automatically
axiosAgent.get('https://npmjs.com/<not-found>/').catch(enhancedError => console.error(enhancedError));

// or using async/await
(async () => {
  try {
    await axiosAgent.get('https://npmjs.com/<not-found>/');
  } catch (enhancedError) {
    console.error(enhancedError);
  }
})();

// or using a response interceptor and an error callback (e.g. could be useful with a logging middleware)
axiosAgent.interceptors.response.use(response => response, enhancedError => {
  console.error(enhancedError);

  return result;
});

// you can restore original agent behavior if needed
const restoreAgent = axiosBetterStacktrace(axiosAgent);

// some code here...

restoreAgent && restoreAgent();
```

See also [demo](./demo/index.ts).

## Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| errorMsg | `String` | `Axios Better Stacktrace` | Error message to show next to the original one in the output. |

## Example

Default axios error without an `axios-better-stacktrace` plugin:

```
Error: Request failed with status code 404
    at createError (./node_modules/axios/lib/core/createError.js:16:15)
    at settle (./node_modules/axios/lib/core/settle.js:17:12)
    at IncomingMessage.handleStreamEnd (./node_modules/axios/lib/adapters/http.js:244:11)
    at IncomingMessage.emit (node:events:388:22)
    at IncomingMessage.EventEmitter.emit (node:domain:470:12)
    at endReadableNT (node:internal/streams/readable:1294:12)
    at processTicksAndRejections (node:internal/process/task_queues:80:21)
```

Enhanced axios error with an `axios-better-stacktrace` plugin (run `yarn demo` to see):

```
Error: Request failed with status code 404
    at createError (./node_modules/axios/lib/core/createError.js:16:15)
    at settle (./node_modules/axios/lib/core/settle.js:17:12)
    at IncomingMessage.handleStreamEnd (./node_modules/axios/lib/adapters/http.js:244:11)
    at IncomingMessage.emit (node:events:388:22)
    at IncomingMessage.EventEmitter.emit (node:domain:470:12)
    at endReadableNT (node:internal/streams/readable:1294:12)
    at processTicksAndRejections (node:internal/process/task_queues:80:21)
Error: Axios Better Stacktrace
    at Function.axiosBetterStacktraceMethodProxy [as get] (./src/axiosBetterStacktrace.ts:167:15)
    at getNpmPage (./demo/index.ts:10:35) <---- this is what usually useful to know for further debugging and this plugin adds 🙂
    at ./demo/index.ts:13:9
    at step (./demo/index.ts:33:23)
    at Object.next (./demo/index.ts:14:53)
    at ./demo/index.ts:8:71
    at new Promise (<anonymous>)
    at __awaiter (./demo/index.ts:4:12)
    at ./demo/index.ts:12:2
    at Object.<anonymous> (./demo/index.ts:16:3)
```
