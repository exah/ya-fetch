<h1 align="center">ya-fetch</h1>

[![](https://flat.badgen.net/bundlephobia/minzip/ya-fetch)](https://bundlephobia.com/result?p=ya-fetch)

> Super light-weight wrapper around `fetch`

- [x] Only 974 B when minified & gziped
- [x] Only native API (polyfills for `fetch`, `AbortController` required)
- [x] Strictly typed with TS
- [x] Instance with custom defaults
- [x] Methods shortcuts
- [x] Response type shortcuts
- [x] First class JSON support
- [x] Search params
- [x] Timeouts
- [x] Pure ESM module
- [x] Zero deps

## 📦 Install

```sh
$ yarn add ya-fetch
```

```js
import * as YF from 'ya-fetch'

// inside an aync function
const result = await YF.patch('http://example.com/posts', {
  params: { id: 1 },
  json: { title: 'New Post' },
}).json()

console.log(result)
// → { userId: 1, id: 1, title: 'New Post', body: 'Some text', }
```

## 💻 Usage

### Create instance

```js
// api.js
import * as YF from 'ya-fetch'

const api = YF.create({
  prefixUrl: 'https://jsonplaceholder.typicode.com',
  headers: {
    Authorization: 'Bearer 943b1a29b46248b29336164d9ec5f217',
  },
})

export default api
```

### Search params

```js
import api from './api'

api.get('/posts', { params: { userId: 1 } }).json()
```

<details><summary>Same code without wrapper</summary>

```js
fetch('http://example.com/posts?id=1').then((res) => {
  if (res.ok) {
    return res.json()
  }

  throw new Error('Oops')
})
```

</details>

### Send & receive JSON

```js
import api from './api'

api.post('/posts', { json: { title: 'New Post' } }).json()
```

<details><summary>Same code without wrapper</summary>

```js
fetch('http://example.com/posts', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json',
  },
  body: JSON.stringify({ title: 'New Post' }),
}).then((res) => {
  if (res.ok) {
    return res.json()
  }

  throw new Error('Oops')
})
```

</details>

### Instance with dynamic headers

You can use an async or regular function to return options for request dynamically.

```js
// api.js
import * as YF from 'ya-fetch'
import { getToken } from './async-state'

const api = YF.create({
  prefixUrl: 'https://jsonplaceholder.typicode.com',
  async getOptions(url, options) {
    const token = await getToken()

    return {
      headers: {
        Authorization: `Bearer ${await getToken()}`,
      },
    }
  },
})

export default api
```

### Timeout

Cancel request if it is not fulfilled in period of time.

```js
import { TimeoutError } from 'ya-fetch'
import api from './api'

api
  .get('/posts', { timeout: 300 })
  .json()
  .then((posts) => console.log(posts))
  .catch((error) => {
    if (error instanceof TimeoutError) {
      // do something
    }
  })
```

<details><summary>Same code without wrapper</summary>

```js
const controller = new AbortController()

setTimeout(() => {
  controller.abort()
}, 300)

fetch('http://example.com/posts', {
  signal: controller.signal,
  headers: {
    accept: 'application/json',
  },
})
  .then((res) => {
    if (res.ok) {
      return res.json()
    }

    throw new Error('Oops')
  })
  .catch((error) => {
    if (error.name === 'AbortError') {
      // do something
    }
  })
```

</details>

### Cancel request

> This feature may require polyfill for [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController.html) and `fetch`.

```js
import { useEffect, useState } from 'react'
import api from './api'

export function usePosts() {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    const controller = new AbortController()

    api
      .get('/posts', { signal: controller.signal })
      .json()
      .then((data) => setPosts(data))
      .catch((error) => {
        if (error.name === 'AbortError') {
          // do something
        }
      })

    return () => controller.abort()
  }, [setPosts])

  return posts
}
```

### Provide custom search params serializer

By default parsed & stringified with [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLsearchParams).

```js
import * as YF from 'ya-fetch'
import queryString from 'query-string'

const api = YF.create({
  prefixUrl: 'https://jsonplaceholder.typicode.com',
  serializer(params) {
    return queryString.stringify(params, { arrayFormat: 'bracket' })
  },
})

api.get('/posts', { params: { userId: 1, tags: [1, 2] } })
// https://jsonplaceholder.typicode.com/posts?userId=1&tags[]=1&tags[]=2
```

### Node.js Support

Install [`node-fetch`](https://github.com/node-fetch/node-fetch), [`form-data`](https://github.com/form-data/form-data), [`abort-controller`](https://github.com/mysticatea/abort-controller) packages and setup them as globally available variables.

```sh
yarn add node-fetch abort-controller
```

```js
import fetch, { Headers, Request, Response, FormData } from 'node-fetch'
import AbortController from 'abort-controller'

globalThis.fetch = fetch
globalThis.Headers = Headers
globalThis.Request = Request
globalThis.Response = Response
globalThis.AbortController = AbortController
globalThis.FormData = FormData
```

> ⚠️ Please, note `node-fetch` v2 may hang on large response when using `.clone()` or response type shortcuts (like `.json()`), because of smaller buffer size (16 kB). Use v3 instead and override default value of 10mb when needed with `highWaterMark` option.

## 📖 API

### Instance

```ts
interface Instance extends Request {
  get: Request
  post: Request
  put: Request
  patch: Request
  head: Request
  delete: Request
  options: Options
  extend(options?: Options): Instance
}
```

### Options

```ts
interface Options extends RequestInit {
  /** Object that will be stringified with `JSON.stringify` */
  json?: unknown
  /** Object that can be passed to `serialize` */
  params?: Record<string, any>
  /** Throw `TimeoutError` if timeout is passed */
  timeout?: number
  /** String that will prepended to `resource` in `fetch` instance */
  prefixUrl?: string
  /** Request headers */
  headers?: Record<string, string>
  /**`node-fetch` v3 option, default is 10mb */
  highWaterMark?: number
  /** Request headers, can be async */
  getOptions?(
    resource: string,
    options: Options
  ): Promise<Options> | Promise<void> | Options | void
  /** Custom params serializer, default to `URLSearchParams` */
  serialize?(params: Record<string, any>): URLSearchParams | string
  /** Response handler, must handle status codes or throw `ResponseError` */
  onResponse?(
    response: Response,
    options: Options
  ): Response | Promise<Response>
  /** Response handler with sucess status codes 200-299 */
  onSuccess?(response: Response, options: Options): Response | Promise<Response>
  /** Error handler. Throw passed `error` for unhandled cases, throw custom errors, or return the new `Response` */
  onFailure?(
    error: ResponseError | AbortError | TimeoutError | TypeError | Error,
    options: Options
  ): Response | Promise<Response>
  /** Transform parsed JSON from response */
  onJSON?(input: unknown): unknown
}
```

### ResponseBody

```ts
interface ResponseBody extends Promise<Response> {
  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}
```

## 🔗 Alternatives

- [`ky`](https://github.com/sindresorhus/ky) - Library that inspired this one, but 3x times bigger and not transpiled for es5 browsers
- [`axios`](https://github.com/axios/axios) - Based on old `XMLHttpRequests` API, almost 5x times bigger, but super popular and feature packed

---

MIT © [John Grishin](http://johngrish.in)
