<h1 align="center">ya-fetch</h1>

[![](https://flat.badgen.net/bundlephobia/minzip/ya-fetch)](https://bundlephobia.com/result?p=ya-fetch)

> Super light-weight wrapper around `fetch`

- [x] Only 1 kB when minified & gziped
- [x] Based on [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) & [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [x] Custom [instance](#create) with options (`headers`, `error` handlers, ...)
- [x] Exposed response body [methods](#response-methods) (`.json`, `.blob`, ...)
- [x] First-class [JSON support](#send--receive-json) (automatic serialization, content type headers)
- [x] [Search params](#params-urlsearchparams--object--string) serialization
- [x] Global [timeouts](#timeout-number)
- [x] Written in TypeScript
- [x] Pure ESM module
- [x] Zero deps

## 📦 Install

```sh
$ npm install --save ya-fetch
```

## ⬇️ Jump to

- [Examples](#👀-examples)
- [API](#📖-api)

## 👀 Examples

### Make a request

```js
import * as YF from 'ya-fetch'

await YF.patch('https://jsonplaceholder.typicode.com/posts/1', {
  json: {
    title: 'New Title',
  },
}).json()

// → { id: 1, title: 'New Title', ... }
```

### Create instance

```js
// api.js
import * as YF from 'ya-fetch'

export const api = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
})
```

### Set search params

```js
import { api } from './api'

await api.get('/posts', { params: { userId: 1 } }).json()
```

<details><summary>Same code with native <code>fetch</code></summary>

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
import { api } from './api'

await api.post('/posts', { json: { title: 'New Post' } }).json()
```

<details><summary>Same code with native <code>fetch</code></summary>

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

### Set options dynamically

You can use an async or regular function to modify the options before the request.

```js
// api.js
import * as YF from 'ya-fetch'
import { getToken } from './global-state'

export const api = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
  async onRequest(options) {
    options.headers.set('Authorization', `Bearer ${await getToken()}`)
  },
})
```

### Send form data (native fetch behaviour)

Provide `FormData` object inside `body` to send `multipart/form-data` request, headers are set automatically by following native [fetch](http://developer.mozilla.org/en-US/docs/Web/API/fetch) behaviour.

```js
const body = new FormData()

body.set('title', 'My Title')
body.set('image', myFile, 'image.jpg')

// will send 'Content-type': 'multipart/form-data' request
await api.post('/posts', { body }).void() // → undefined
```

### Timeout

Cancel request if it is not fulfilled in period of time.

```js
import { TimeoutError } from 'ya-fetch'
import { api } from './api'

try {
  await api.get('/posts', { timeout: 300 }).json()
} catch (error) {
  if (error instanceof TimeoutError) {
    // do something, or nothing
  }
}
```

<details><summary>Same code with native <code>fetch</code></summary>

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

### Provide custom search params serializer

> By default parsed and stringified with [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLsearchParams) and additional improvements to parsing of arrays.

```js
import * as YF from 'ya-fetch'
import queryString from 'query-string'

const api = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
  serializer: (params) =>
    queryString.stringify(params, { arrayFormat: 'bracket' }),
})

// will send request to: 'https://jsonplaceholder.typicode.com/posts?userId=1&tags[]=1&tags[]=2'
await api.get('/posts', { params: { userId: 1, tags: [1, 2] } })
```

### Extend an instance

It's also possible to create extended version of existing by providing additional options. In this example the new instance will have `https://jsonplaceholder.typicode.com/posts` as `resource` inside the extended options:

```js
import { api } from './api'

const posts = api.extend({
  resource: '/posts',
})

await posts.get().json() // → [{ id: 0, title: 'Hello' }, ...]
await posts.get(0).json() // → { id: 0, title: 'Hello' }
await posts.post({ json: { title: 'Bye' } }).json() // → { id: 1, title: 'Bye' }
await posts.patch(0, { json: { title: 'Hey' } }).json() // → { id: 0, title: 'Hey' }
await posts.delete(1).void() // → undefined
```

### Node.js Support

Install [`node-fetch`](https://github.com/node-fetch/node-fetch), [`abort-controller`](https://github.com/mysticatea/abort-controller) packages and setup them as globally available variables.

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
globalThis.FormData = FormData
globalThis.AbortController = AbortController
```

> ⚠️ Please, note `node-fetch` v2 may hang on large response when using `.clone()` or response type shortcuts (like `.json()`) because of smaller buffer size (16 kB). Use v3 instead and override default value of 10mb when needed with `highWaterMark` option.

## 📖 API

```ts
import * as YF from 'ya-fetch'

// YF.create
// YF.get
// YF.post
// YF.patch
// YF.put
// YF.delete
// YF.head
```

### create

```ts
function create(options: Options): Instance
```

Creates an instance with needed defaults. Specify parts of `resource` url, `headers`, `response` or `error` handlers, and more:

```ts
const instance = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
  headers: {
    'x-from': 'Website',
  },
})

// instance.get
// instance.post
// instance.patch
// instance.put
// instance.delete
// instance.head
// instance.extend
```

### extend

Take an instance and extend it with additional options, the [`headers`](#headers-headersinit) and [`params`](#params-urlsearchparams--object--string) will be merged with values provided in parent instance, the [`resource`](#resource-string) will concatenated to the parent value.

```js
const instance = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
  headers: { 'X-Custom-Header': 'Foo' },
})

// will have combined `resource` and merged `headers`
const extension = instance.extend({
  resource: '/posts'
  headers: { 'X-Something-Else': 'Bar' },
})

// will send request to: 'https://jsonplaceholder.typicode.com/posts/1'
await extension.post(1)
```

#### Related

- [Create instance](#create-instance)
- [Set options dynamically](#set-options-dynamically)
- [Provide custom search params serializer](#provide-custom-search-params-serializer)

### get<br>post<br>patch<br>put<br>delete<br>head

```ts
function (resource?: string, options?: Options): ResponsePromise
```

Calls `fetch` with preset request method and options:

```ts
await YF.get('https://jsonplaceholder.typicode.com/posts').json()
// → [{ id: 0, title: 'Hello' }, ...]
```

The same functions are returned after [creating an instance](#create) with preset options:

```ts
const instance = YF.create({ resource: 'https://jsonplaceholder.typicode.com' })
await instance.get('/posts').json()
// → [{ id: 0, title: 'Hello' }, ...]
```

#### Returns `ResponsePromise` with exposed body methods:

#### → json\<T>(): Promise\<T>

Sets `Accept: 'application/json'` in `headers` and parses the `body` as JSON:

```ts
interface Post {
  id: number
  title: string
  content: string
}

const post = await instance.get('/posts').json<Post[]>()
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
interface Post {
  id: number
  title: string
  content: string
}

const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
  headers: { Accept: 'application/json' },
})

if (response.ok) {
  const post: Post[] = await response.json()
}
```

</details>

#### → text(): Promise\<string>

Sets `Accept: 'text/*'` in `headers` and parses the `body` as plain text:

```ts
await instance.delete('/posts/1').text() // → 'OK'
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
  headers: { Accept: 'text/*' },
  method: 'DELETE',
})

if (response.ok) {
  await response.text() // → 'OK'
}
```

</details>

#### → formData(): Promise\<FormData>

Sets `Accept: 'multipart/form-data'` in `headers` and parses the `body` as [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData):

```ts
const body = new FormData()

body.set('title', 'Hello world')
body.set('content', '🌎')

const data = await instance.post('/posts', { body }).formData()

data.get('id') // → 1
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
const body = new FormData()

body.set('title', 'Hello world')
body.set('content', '🌎')

const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
  headers: { Accept: 'multipart/form-data' },
  method: 'POST',
  body,
})

if (response.ok) {
  const data = await response.formData()

  data.get('id') // → 1
}
```

</details>

#### → arrayBuffer(): Promise\<ArrayBuffer>

```
TODO
```

#### → blob(): Promise\<Blob>

```
TODO
```

#### → void(): Promise\<void>

```
TODO
```

### options

Accepts all the options from native [fetch](http://developer.mozilla.org/en-US/docs/Web/API/fetch#parameters) in the desktop browsers, or [`node-fetch`](https://github.com/node-fetch/node-fetch#options) in node.js. Additionally you can specify the options:

- [resource](#resource-string)
- [headers](#headers-headersinit)
- [json](#json-unknown)
- [params](#params-urlsearchparams--object--string)
- [serialize](#serialize-params-object-urlsearchparams--string)
- [timeout](#timeout-number)

And global hooks:

- [onRequest](#onrequestoptions-requestoptions-promisevoid--void)
- [onResponse](#onresponseresponse-response-promiseresponse--response)
- [onSuccess](#onsuccessresponse-response-promiseresponse--response)
- [onFailure](#onfailureerror-responseerror--timeouterror--error-promiseresponse--response)

#### resource?: string

Part of the request URL. If used multiple times all the parts will be concatenated to final URL. The same as first argument of `get`, `post`, `patch`, `put`, `delete`, `head`.

```ts
const instance = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
})

// will me merged and send request to 'https://jsonplaceholder.typicode.com/posts'
await instance.get('/posts')

// same as
await YF.get('https://jsonplaceholder.typicode.com/posts')

// will me merged to 'https://jsonplaceholder.typicode.com/posts'
const posts = instance.extend({
  resource: '/posts',
})

// will send request to 'https://jsonplaceholder.typicode.com/posts'
await posts.get()
```

#### headers?: HeadersInit

Request headers, the same as in [Fetch](http://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), except multiple `headers` will merge when you [extend](#extend) an instance.

```ts
const instance = YF.create({
  headers: { 'x-from': 'Website' },
})

// will use instance `headers`
await instance.get('https://jsonplaceholder.typicode.com/posts')

// will be merged with instance `headers`
const authorized = instance.extend({
  headers: { Authorization: 'Bearer token' },
})

// will be sent with `Authorization` and `x-from` headers
await authorized.post('https://jsonplaceholder.typicode.com/posts')
```

#### json?: unknown

Body for `application/json` type requests, stringified with `JSON.stringify` and applies needed headers automatically.

```ts
await instance.patch('/posts/1', { json: { title: 'Hey' } })
```

#### params?: URLSearchParams | object | string

Search params to append to the request URL. Provide an `object`, `string`, or `URLSearchParams` instance. The `object` will be stringified with [`serialize`](#serialize-params-object-urlsearchparams--string) function.

```ts
// request will be sent to 'https://jsonplaceholder.typicode.com/posts?userId=1'
await instance.get('/posts', { params: { userId: 1 } })
```

#### serialize?: (params: object): URLSearchParams | string

Custom search params serializer when `object` is used. Defaults to internal implementation based on `URLSearchParams` with better handling of array values.

```ts
import queryString from 'query-string'

const instance = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
  serialize: (params) =>
    queryString.stringify(params, {
      arrayFormat: 'bracket',
    }),
})

// request will be sent to 'https://jsonplaceholder.typicode.com/posts?userId=1&tags[]=1&tags[]=2'
await instance.get('/posts', { params: { userId: 1, tags: [1, 2] } })
```

#### timeout?: number

If specified, `TimeoutError` will be thrown and the request will be cancelled after the specified duration.

```ts
try {
  await instance.get('/posts', { timeout: 500 })
} catch (error) {
  if (error instanceof TimeoutError) {
    // do something, or nothing
  }
}
```

#### onRequest?(options: RequestOptions): Promise\<void> | void

Request handler. Use the callback to modify options before the request or cancel the request. Please, note the options here are in the final state before the request will be made, this means `resource` is string, `params` is instance of `URLSearchParams`, and `headers` is instance of `Headers`.

```ts
const authorized = instance.extend({
  async onRequest(options) {
    // fetch 'token' somehow
    options.headers.set('Authorization', `Bearer ${await 'token'}`)
  },
})

// request will be sent with `Authorization` header resolved with async `Bearer token`.
await authorized.get('/posts')
```

```ts
const cancellable = instance.extend({
  onRequest(options) {
    if (options.resource.endsWith('/posts')) {
      // cancels the request if condition is met
      options.signal = AbortSignal.abort()
    }
  },
})

// will be cancelled
await cancellable.get('/posts')
```

#### onResponse?(response: Response): Promise\<Response> | Response

Response handler, handle status codes or throw `ResponseError`.

```ts
const instance = YF.create({
  onResponse(response) {
    // this is the default handler
    if (response.ok) {
      return response
    }

    throw new ResponseError(response)
  },
})
```

#### onSuccess?(response: Response): Promise\<Response> | Response

Success response handler (usually codes 200-299), handled in [`onResponse`](#onresponseresponse-response-promiseresponse--response).

```ts
const instance = YF.create({
  onSuccess(response) {
    // you can modify the response in any way you want
    // or even make a new request
    return new Response(response.body, response)
  },
})
```

#### onFailure?(error: ResponseError | TimeoutError | Error): Promise\<Response> | Response

Throw custom error with additional data, return a new `Promise` with `Response` using `request`, or just submit an event to error tracking service.

```ts
class CustomResponseError extends YF.ResponseError {
  data: unknown
  constructor(response: YF.Response, data: unknown) {
    super(response)
    this.data = data
  }
}

const api = YF.create({
  resource: 'http://localhost',
  async onFailure(error) {
    if (error instanceof YF.ResponseError) {
      if (error.response.status < 500) {
        throw new CustomResponseError(
          error.response,
          await error.response.json()
        )
      }
    }

    trackError(error)
    throw error
  },
})
```

#### onJSON(input: unknown): unknown

Customize global handling of the [json](#→-jsont-promiset) body. Useful for the cases when all the BE json responses inside the same shape object with `.data`.

```js
const api = YF.create({
  onJSON(input) {
    // In case needed data inside object like
    // { data: unknown, status: string })
    if (typeof input === 'object' && input !== null) {
      return input.data
    }

    return input
  },
})
```

### request

```
TODO
```

### ResponseError

```
TODO
```

### TimeoutError

```
TODO
```

---

MIT © [John Grishin](http://johngrish.in)
