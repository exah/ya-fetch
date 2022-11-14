<h1 align="center">ya-fetch</h1>

> Super light-weight wrapper around `fetch`

- [x] Only 1 kB when minified & gziped
- [x] Based on [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) & [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [x] Custom [instance](#create) with options (`headers`, `error` handlers, ...)
- [x] Exposed response body [methods](#returns-response-promise) (`.json`, `.blob`, ...)
- [x] First-class [JSON support](#send--receive-json) (automatic serialization, content type headers)
- [x] [Search params](#params-urlsearchparams--object--string) serialization
- [x] Global [timeouts](#timeout-number)
- [x] [Works in a browser](#-import-in-a-browser) without a bundler
- [x] Written in TypeScript
- [x] Pure ESM module
- [x] Zero deps

## 📦 Install

```sh
$ npm install --save ya-fetch
```

## 🌎 Import in a browser

```html
<script type="module">
  import * as YF from 'https://unpkg.com/ya-fetch/esm/min.js'
</script>
```

For readable version import from `https://unpkg.com/ya-fetch/esm/index.js`.

[🔗 Playground on CodePen](https://codepen.io/exah/pen/gOKRYjW?editors=0012).

## ⬇️ Jump to

- [📖 API](#-api)
- [🔧 Options](#-options)
- [🔥 Migration from v1 → v2](#-migration-from-v1--v2)

## 👀 Examples

### Import module

```ts
import * as YF from 'ya-fetch' // or from 'https://unpkg.com/ya-fetch/esm/min.js' in browsers
```

### Create an instance

```ts
const api = YF.create({ resource: 'https://jsonplaceholder.typicode.com' })
```

#### Related

- [`create`](#create)
- [`instance`](#returns-instance)
- [`options.resource`](#resource-string)

### Send & receive JSON

```ts
await api.post('/posts', { json: { title: 'New Post' } }).json()
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
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

```ts
await api.get('/posts', { params: { userId: 1 } }).json()
```

<details><summary>Same code with native <code>fetch</code></summary>

```ts
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

```ts
import { getToken } from './global-state'

const authorized = YF.create({
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

Install [`node-fetch`](https://github.com/node-fetch/node-fetch) and setup it as globally available variable.

```sh
npm install --save node-fetch
```

```js
import fetch, { Headers, Request, Response, FormData } from 'node-fetch'

globalThis.fetch = fetch
globalThis.Headers = Headers
globalThis.Request = Request
globalThis.Response = Response
globalThis.FormData = FormData
```

> ⚠️ Please, note `node-fetch` v2 may hang on large response when using `.clone()` or response type shortcuts (like `.json()`) because of smaller buffer size (16 kB). Use v3 instead and override default value of 10mb when needed with [`highWaterMark`](https://github.com/node-fetch/node-fetch#custom-highwatermark) option.
>
> ```ts
> const instance = YF.create({
>   highWaterMark: 1024 * 1024 * 10, // default
> })
> ```

## ↕️ Jump to

- [👀 Examples](#-examples)
- [🔧 Options](#-options)
- [🔥 Migration from v1 → v2](#-migration-from-v1--v2)

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

Creates an [instance](#returns-instance) with preset default [options](#-options). Specify parts of `resource` url, `headers`, `response` or `error` handlers, and more:

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
  get(resource?: string, options?: Options): ResponsePromise
  post(resource?: string, options?: Options): ResponsePromise
  patch(resource?: string, options?: Options): ResponsePromise
  put(resource?: string, options?: Options): ResponsePromise
  delete(resource?: string, options?: Options): ResponsePromise
  head(resource?: string, options?: Options): ResponsePromise
  extend(options?: Options): Instance
}
```

Instance with preset [options](#-options), and [extend](#extend) method:

#### get<br>post<br>patch<br>put<br>delete<br>head

```ts
function requestMethod(resource?: string, options?: Options): ResponsePromise
```

Same as [`get`](#getbrpostbrpatchbrputbrdeletebrhead), [`post`](<(#getbrpostbrpatchbrputbrdeletebrhead)>), [`patch`](<(#getbrpostbrpatchbrputbrdeletebrhead)>), [`put`](#getbrpostbrpatchbrputbrdeletebrhead), [`delete`](#getbrpostbrpatchbrputbrdeletebrhead), or [`head`](#getbrpostbrpatchbrputbrdeletebrhead) function exported from the module, but with preset [options](#-options).

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
const extended = instance.extend({
  resource: '/posts'
  headers: { 'X-Something-Else': 'Bar' },
})

// will send request to: 'https://jsonplaceholder.typicode.com/posts/1'
await extended.post(1, { json: { title: 'Hello' } })
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
const nothing = await instance.post('/posts', { title: 'Hello' }).void()
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

## ↕️ Jump to

- [👀 Examples](#-examples)
- [📖 API](#-api)
- [🔥 Migration from v1 → v2](#-migration-from-v1--v2)

## 🔧 Options

Accepts all the options from native [fetch](http://developer.mozilla.org/en-US/docs/Web/API/fetch#parameters) in the desktop browsers, or [`node-fetch`](https://github.com/node-fetch/node-fetch#options) in node.js. Additionally you can specify:

- [resource](#resource-string)
- [base](#base-string)
- [headers](#headers-headersinit)
- [json](#json-unknown)
- [params](#params-urlsearchparams--object--string)
- [serialize](#serialize-params-object-urlsearchparams--string)
- [timeout](#timeout-number)
- [onRequest](#onrequesturl-url-options-requestoptions-promisevoid--void)
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
const result = await posts.get().json() // → [{ id: 0, title: 'Title', ... }]
```

##### Related

- [Create and instance](#create-an-instance)
- [Extend and instance](#extend-an-instance)
- [`create`](#create)
- [`get`](#getbrpostbrpatchbrputbrdeletebrhead)
- [`instance`](#returns-instance)
- [`instance.extend`](#extend)

#### base?: string

Base of a [URL](http://developer.mozilla.org/en-US/docs/Web/API/URL), use it only if you want to specify relative url inside [resource](#resource-string). By default equals to `location.origin` if available. Not merged when you [extend](#extend) an instance. Most of the time use [resource](#resource-string) option instead.

```ts
// send a request to `new URL('/posts', location.origin)` if possible
await YF.get('/posts')

// send a request to `https://jsonplaceholder.typicode.com/posts`
await YF.get('https://jsonplaceholder.typicode.com/posts')

// send a request to `new URL('/posts', 'https://jsonplaceholder.typicode.com')`
await YF.get('/posts', { base: 'https://jsonplaceholder.typicode.com' })
```

##### Related

- [Create and instance](#create-an-instance)
- [Extend and instance](#extend-an-instance)
- [`options.resource`](#resource-string)

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
  if (error instanceof YF.ResponseError) {
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
  if (error instanceof YF.TimeoutError) {
    // do something, or nothing
  }
}
```

## ⬆️ Jump to

- [👀 Examples](#-examples)
- [📖 API](#-api)
- [🔧 Options](#-options)

## 🔥 Migration from v1 → v2

### Renamed `prefixUrl` → [`resource`](#resource-string)

```diff
const api = YF.create({
-  prefixUrl: 'https://example.com'
+  resource: 'https://example.com'
})
```

### Removed `getHeaders` option

Use [`onRequest`](#onrequesturl-url-options-requestoptions-promisevoid--void) instead:

```diff
const api = YF.create({
-  async getHeaders(url, options) {
-    return {
-      Authorization: `Bearer ${await getToken()}`,
-    }
-  },
+  async onRequest(url, options) {
+    options.headers.set('Authorization', `Bearer ${await getToken()}`)
+  },
})
```

### CommonJS module format support dropped

Use dynamic `import` inside CommonJS project instead of `require` (or transpile the module with webpack/rollup, or vite):

```diff
- const YF = require('ya-fetch')
+ import('ya-fetch').then((YF) => { /* do something */ })
```

### Module exports changed

The module doesn't include a default export anymore, use namespace import instead of default:

```diff ts
- import YF from 'ya-fetch'
+ import * as YF from 'ya-fetch'
```

### Errors are own instances based on [Error](http://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)

```diff
import * as YF from 'ya-fetch'

try {
-  throw YF.ResponseError(new Response()) // notice no 'new' keyword before `ResponseError`
+  throw new YF.ResponseError(new Response())
} catch (error) {
-  if (YF.isResponseError(error)) {
+  if (error instanceof YF.ResponseError) {
      console.log(error.response.status)
  }
}
```

#### Related

- [`ResponseError`](#responseerror)
- [`TimeoutError`](#timeouterror)

### Use spec compliant check for `AbortError`

There is no globally available `AbortError` but you can check `.name` property on `Error`:

```ts
try {
  await YF.get('https://jsonplaceholder.typicode.com/posts', {
    signal: AbortSignal.abort(),
  })
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    /* do something or nothing */
  }
}
```

If you use `ya-fetch` only in [Node.js](https://nodejs.org/en/) environment, then you can import `AbortError` class from [node-fetch](https://github.com/node-fetch/node-fetch#class-aborterror) module and check the error:

```ts
import { AbortError } from 'node-fetch'

try {
  await YF.get('https://jsonplaceholder.typicode.com/posts', {
    signal: AbortSignal.abort(),
  })
} catch (error) {
  if (error instanceof AbortError) {
    /* do something or nothing */
  }
}
```

### Removed `options` from the second argument of `onResponse`, `onSuccess`, and `onFailure`

```diff
const api = YF.create({
-  async onFailure(error, options) {
-    console.log(options.headers)
-  },
+  async onFailure(error) {
+    if (error instanceof YF.ResponseError) {
+      console.log(error.response.options.headers)
+    }
+  },
})
```

### Removed helpers

- `isResponseError` → `error instanceof YF.ResponseError`
- `isTimeoutError` → `error instanceof YF.TimeoutError`
- `isAbortError` → `error instanceof Error && error.name === 'AbortError'`

## 🔗 Alternatives

- [`ky`](https://github.com/sindresorhus/ky) - Library that inspired this one, but 3x times bigger and feature packed
- [`axios`](https://github.com/axios/axios) - Based on old `XMLHttpRequests` API, almost 9x times bigger, but super popular and feature packed

---

MIT © [John Grishin](http://johngrish.in)
