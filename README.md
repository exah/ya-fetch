<h1 align="center">ya-fetch</h1>

[![](https://flat.badgen.net/bundlephobia/minzip/ya-fetch)](https://bundlephobia.com/result?p=ya-fetch)

> Super light-weight wrapper around `fetch`

- [x] Only 822 B when minified & gziped
- [x] Only native API (polyfills for `fetch`, `AbortController` required)
- [x] TypeScript support
- [x] Instance with custom defaults
- [x] Methods shortcuts
- [x] Response type shortcuts
- [x] First class JSON support
- [x] Search params
- [x] Timeouts
- [ ] ~~Progress tracking~~
- [ ] ~~Retry~~
- [x] Zero deps

## 📦 Install

```sh
$ yarn add ya-fetch
```

```js
import YF from 'ya-fetch'

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
import YF from 'ya-fetch'

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

### Timeout

Cancel request if it is not fulfilled in period of time.

```js
import { isTimeoutError } from 'ya-fetch'
import api from './api'

api
  .get('/posts', { timeout: 300 })
  .json()
  .then((posts) => console.log(posts))
  .catch((error) => {
    if (isTimeoutError(error)) {
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
import { isAbortError } from 'ya-fetch'
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
        if (isAbortError(error)) {
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
import YF from 'ya-fetch'
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

## 📖 API

### Instance

```ts
type Request = (resource: string, options?: Options) => ResponseBody

interface Instance extends Request {
  create(options?: Options): Instance
  extend(options?: Options): Instance
  options: Options
  get: Request
  post: Request
  put: Request
  patch: Request
  head: Request
  delete: Request
}
```

### Options

```ts
interface Options extends RequestInit {
  /** Object that will be stringified with `JSON.stringify` */
  json?: unknown
  /** Object that can be passed to `serialize` */
  params?: Record<string, any>
  /** Throw `TimeoutError`if timeout is passed */
  timeout?: number
  /** String that will prepended to `resource` in `fetch` instance */
  prefixUrl?: string
  /** Request headers */
  headers?: Record<string, string>
  /** Custom params serializer, default to `URLSearchParams` */
  serialize?(params: Record<string, any>): URLSearchParams | string
  /** Response handler, must handle status codes or throw `ResponseError` */
  onResponse?(
    response: Response,
    options: Options
  ): Response | Promise<Response> | never | Promise<never>
  /** Response handler with sucess status codes 200-299 */
  onSuccess?(response: Response, options: Options): Response | Promise<Response>
  /** Error handler, must throw an `Error` */
  onFailure?(
    error: ResponseError | AbortError | TimeoutError | Error,
    options: Options
  ): never | Promise<never>
  /** Transform parsed JSON from response */
  onJSON?(input: unknown): unknown
}
```

### ResponseBody

```ts
interface ResponseBody extends Promise<Response> {
  json?<T>(): Promise<T>
  text?(): Promise<string>
  blob?(): Promise<Blob>
  arrayBuffer?(): Promise<ArrayBuffer>
  formData?(): Promise<FormData>
}
```

## 🔗 Alternatives

- [`ky`](https://github.com/sindresorhus/ky) - Library that inspired this one, but 3x times bigger and not transpiled for es5 browsers
- [`axios`](https://github.com/axios/axios) - Based on old `XMLHttpRequests` API, almost 5x times bigger, but super popular and feature packed

---

MIT © [John Grishin](http://johngrish.in)
