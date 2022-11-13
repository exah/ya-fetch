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

## ⬇️ Jump to [API docs](#-api)

## 👀 Examples

### Create an instance

```js
import * as YF from 'ya-fetch'

const api = YF.create({ resource: 'https://jsonplaceholder.typicode.com' })
```

#### Related

- [`create`](#create)
- [`instance`](#returns-instance)
- [`options.resource`](#resource-string)

### Send & receive JSON

```js
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

#### Related

- [`post`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`options.json`](#json-unknown)
- [`response.json`](#json)

### Set search params

```js
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

#### Related

- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`options.params`](#params-urlsearchparams--object--string)
- [`options.serialize`](#serialize-params-object-urlsearchparams--string)
- [`response.json`](#json)

### Set options dynamically

You can use an async or regular function to modify the options before the request.

```js
import * as YF from 'ya-fetch'
import { getToken } from './global-state'

const api = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
  async onRequest(url, options) {
    options.headers.set('Authorization', `Bearer ${await getToken()}`)
  },
})
```

#### Related

- [`create`](#create)
- [`options.resource`](#resource-string)
- [`options.onRequest`](#onrequesturl-url-options-requestoptions-promisevoid--void)

### Send form data (native fetch behaviour)

Provide `FormData` object inside `body` to send `multipart/form-data` request, headers are set automatically by following native [fetch](http://developer.mozilla.org/en-US/docs/Web/API/fetch) behaviour.

```js
const body = new FormData()

body.set('title', 'My Title')
body.set('image', myFile, 'image.jpg')

// will send 'Content-type': 'multipart/form-data' request
await api.post('/posts', { body })
```

#### Related

- [`create`](#create)
- [`options.resource`](#resource-string)
- [`options.onRequest`](#onrequestoptions-requestoptions-promisevoid--void)

### Set timeout

Cancel request if it is not fulfilled in period of time.

```js
import * as YF from 'ya-fetch'

try {
  await api.get('/posts', { timeout: 300 }).json()
} catch (error) {
  if (error instanceof YF.TimeoutError) {
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

#### Related

- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`options.timeout`](#timeout-number)
- [`response.json`](#json)

### Provide custom search params serializer

> By default parsed and stringified with [URLSearchParams](https://developer.mozilla.org/en-US/docs/Web/API/URLsearchParams) and additional improvements to parsing of arrays.

```js
import * as YF from 'ya-fetch'
import queryString from 'query-string'

const api = YF.create({
  resource: 'https://jsonplaceholder.typicode.com',
  serialize: (params) =>
    queryString.stringify(params, { arrayFormat: 'bracket' }),
})

// will send request to: 'https://jsonplaceholder.typicode.com/posts?userId=1&tags[]=1&tags[]=2'
await api.get('/posts', { params: { userId: 1, tags: [1, 2] } })
```

#### Related

- [`create`](#create)
- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`options.resource`](#resource-string)
- [`options.params`](#params-urlsearchparams--object--string)
- [`options.serialize`](#serialize-params-object-urlsearchparams--string)

### Extend an instance

It's also possible to create extended version of existing by providing additional options. In this example the new instance will have `https://jsonplaceholder.typicode.com/posts` as `resource` inside the extended options:

```js
const posts = api.extend({ resource: '/posts' })

await posts.get().json() // → [{ id: 0, title: 'Hello' }, ...]
await posts.get(0).json() // → { id: 0, title: 'Hello' }
await posts.post({ json: { title: 'Bye' } }).json() // → { id: 1, title: 'Bye' }
await posts.patch(0, { json: { title: 'Hey' } }).json() // → { id: 0, title: 'Hey' }
await posts.delete(1).void() // → undefined
```

#### Related

- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`post`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`patch`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`delete`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`instance`](#returns-instance)
- [`instance.extend`](#extend)
- [`options.resource`](#resource-string)
- [`options.json`](#json-unknown)
- [`response.json`](#json)
- [`response.void`](#void)

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

> ⚠️ Please, note `node-fetch` v2 may hang on large response when using `.clone()` or response type shortcuts (like `.json()`) because of smaller buffer size (16 kB). Use v3 instead and override default value of 10mb when needed with [`highWaterMark`](https://github.com/node-fetch/node-fetch#custom-highwatermark) option.
>
> ```ts
> const instance = YF.create({
>   highWaterMark: 1024 * 1024 * 10, // default
> })
> ```

## ⬆️ Jump to [Examples](#-examples)

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

Creates an [instance](#returns-instance) with preset default [options](#options). Specify parts of `resource` url, `headers`, `response` or `error` handlers, and more:

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

#### Related

- [Create an instance](#create-an-instance)
- [`instance`](#returns-instance)
- [`options.resource`](#resource-string)
- [`options.headers`](#headers-headersinit)

#### Returns instance

```ts
interface Instance {
  get: (resource?: string, options?: Options): ResponsePromise
  post: (resource?: string, options?: Options): ResponsePromise
  patch: (resource?: string, options?: Options): ResponsePromise
  put: (resource?: string, options?: Options): ResponsePromise
  delete: (resource?: string, options?: Options): ResponsePromise
  head: (resource?: string, options?: Options): ResponsePromise
  extend(options?: Options): Instance
}
```

Instance with preset [options](#options), and [extend](#extend) method:

#### get<br>post<br>patch<br>put<br>delete<br>head

```ts
function requestMethod(resource?: string, options?: Options): ResponsePromise
```

Same as [`get`](#getbrpostbrpatchbrputbrdeletebrhead), [`post`](<(#getbrpostbrpatchbrputbrdeletebrhead)>), [`patch`](<(#getbrpostbrpatchbrputbrdeletebrhead)>), [`put`](#getbrpostbrpatchbrputbrdeletebrhead), [`delete`](#getbrpostbrpatchbrputbrdeletebrhead), or [`head`](#getbrpostbrpatchbrputbrdeletebrhead) function exported from the module, but with preset [options](#options).

#### extend

```ts
function extend(options?: Options): Instance
```

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

##### Related

- [Create an instance](#create-an-instance)
- [Extend an instance](#extend-an-instance)
- [`create`](#create)
- [`post`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`options.resource`](#resource-string)
- [`options.headers`](#headers-headersinit)

### get<br>post<br>patch<br>put<br>delete<br>head

```ts
function requestMethod(resource?: string, options?: Options): ResponsePromise
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

#### Related

- [Create and instance](#create-an-instance)
- [Send & receive JSON](#send--receive-json)
- [`create`](#create)
- [`options.resource`](#resource-string)
- [`response.json`](#json)

#### Returns response promise

```ts
interface ResponsePromise extends Promise<Response> {
  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}
```

`ResponsePromise` is a promise based object with exposed body methods:

#### json

```ts
function json<T>(): Promise<T>
```

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

##### Related

- [Send & receive JSON](#send--receive-json)

#### text

```ts
function text(): Promise<string>
```

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

#### formData

```ts
function formData(): Promise<FormData>
```

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

#### arrayBuffer

```ts
function arrayBuffer(): Promise<ArrayBuffer>
```

Sets `Accept: '*/*'` in `headers` and parses the `body` as [ArrayBuffer](http://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer):

```ts
const buffer = await instance.get('Example.ogg').arrayBuffer()
const context = new AudioContext()
const source = new AudioBufferSourceNode(context)

source.buffer = await context.decodeAudioData(buffer)
source.connect(context.destination)
source.start()
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
const response = await fetch(
  'https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg'
)

if (response.ok) {
  const data = await response.arrayBuffer()
  const context = new AudioContext()
  const source = new AudioBufferSourceNode(context)

  source.buffer = await context.decodeAudioData(buffer)
  source.connect(context.destination)
  source.start()
}
```

</details>

#### blob

```ts
function blob(): Promise<Blob>
```

Sets `Accept: '*/*'` in `headers` and parses the `body` as [Blob](http://developer.mozilla.org/en-US/docs/Web/API/Blob):

```ts
const blob = await YF.get('https://placekitten.com/200').blob()
const image = new Image()

image.src = URL.createObjectURL(blob)
document.body.append(image)
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
const response = await fetch('https://placekitten.com/200')

if (response.ok) {
  const blob = await response.blob()
  const image = new Image()

  image.src = URL.createObjectURL(blob)
  document.body.append(image)
}
```

</details>

#### void

```ts
function void(): Promise<void>
```

Sets `Accept: '*/*'` in `headers` and returns [`undefined`](http://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined) after the request:

```ts
await instance.post('/posts', { title: 'Hello' })
// do something
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Hello' }),
})

if (response.ok) {
  // do something
}
```

</details>

### options

Accepts all the options from native [fetch](http://developer.mozilla.org/en-US/docs/Web/API/fetch#parameters) in the desktop browsers, or [`node-fetch`](https://github.com/node-fetch/node-fetch#options) in node.js. Additionally you can specify:

- [resource](#resource-string)
- [headers](#headers-headersinit)
- [json](#json-unknown)
- [params](#params-urlsearchparams--object--string)
- [serialize](#serialize-params-object-urlsearchparams--string)
- [timeout](#timeout-number)
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

##### Related

- [Create and instance](#create-an-instance)
- [Extend and instance](#extend-an-instance)
- [`create`](#create)
- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`instance`](#returns-instance)
- [`instance.extend`](#extend)

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

##### Related

- [Create and instance](#create-an-instance)
- [Extend and instance](#extend-an-instance)
- [`create`](#create)
- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`post`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`instance.extend`](#extend)

#### json?: unknown

Body for `application/json` type requests, stringified with `JSON.stringify` and applies needed headers automatically.

```ts
await instance.patch('/posts/1', { json: { title: 'Hey' } })
```

##### Related

- [Send & receive JSON](#send--receive-json)
- [`patch`](#getbrpostbrpatchbrputbrdeletebrhead)

#### params?: URLSearchParams | object | string

Search params to append to the request URL. Provide an `object`, `string`, or `URLSearchParams` instance. The `object` will be stringified with [`serialize`](#serialize-params-object-urlsearchparams--string) function.

```ts
// request will be sent to 'https://jsonplaceholder.typicode.com/posts?userId=1'
await instance.get('/posts', { params: { userId: 1 } })
```

##### Related

- [Set search params](#set-search-params)
- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)

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

##### Related

- [Create an instance](#create-an-instance)
- [Set search params](#set-search-params)
- [`create`](#create)
- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`options.resource`](#resource-string)
- [`options.params`](#params-urlsearchparams--object--string)

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

#### onRequest?(url: URL, options: RequestOptions): Promise\<void> | void

Request handler. Use the callback to modify options before the request or cancel it. Please, note the options here are in the final state before the request will be made. It means `url` is a final instance of [`URL`](http://developer.mozilla.org/en-US/docs/Web/API/URL) with search params already set, `params` is an instance of [`URLSearchParams`](http://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), and `headers` is an instance of [`Headers`](http://developer.mozilla.org/en-US/docs/Web/API/Headers).

```ts
let token
const authorized = instance.extend({
  async onRequest(url, options) {
    if (!token) {
      throw new Error('Unauthorized request')
    }

    options.headers.set('Authorization', `Bearer ${token}`)
  },
})

// request will be sent with `Authorization` header resolved with async `Bearer token`.
await authorized.get('/posts')
```

```ts
const cancellable = instance.extend({
  onRequest(url, options) {
    if (url.pathname.startsWith('/posts')) {
      // cancels the request if condition is met
      options.signal = AbortSignal.abort()
    }
  },
})

// will be cancelled
await cancellable.get('/posts')
```

##### Related

- [Set options dynamically](#set-options-dynamically)
- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`instance.extend`](#extend)
- [`options.headers`](#headers-headersinit)

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

##### Related

- [Create an instance](#create-an-instance)
- [`create`](#create)

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

Customize global handling of the [json](#json) body. Useful for the cases when all the BE json responses inside the same shape object with `.data`.

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

### ResponseError

Instance of [`Error`](http://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) with failed `YF.Response` (based on [Response](http://developer.mozilla.org/en-US/docs/Web/API/Response/Response)) inside `.response`:

```ts
try {
  await instance.get('/posts').json()
} catch (error) {
  if (error instanceof ResponseError) {
    error.response.status // property on Response
    error.response.options // the same as options used to create instance and make a request
  }
}
```

### TimeoutError

Instance of [`Error` ](http://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error) thrown when [timeout](#timeout-number) is reached before finishing the request:

```ts
try {
  await api.get('/posts', { timeout: 300 }).json()
} catch (error) {
  if (error instanceof TimeoutError) {
    // do something, or nothing
  }
}
```

---

MIT © [John Grishin](http://johngrish.in)
