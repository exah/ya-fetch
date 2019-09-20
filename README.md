<h1 align="center">f-e-t-c-h</h1>

> Super light-weight wrapper around `fetch`

- [x] Only 1.18 KB minified & gziped
- [x] Only native API (polyfills required)
- [x] TypeScript support
- [x] Instance with custom defaults
- [x] Methods shortcuts
- [x] Response type shortcuts
- [x] First class JSON support
- [x] Search params
- [x] Timeouts

## 📦 Install

```sh
$ yarn add f-e-t-c-h
```

```js
import F from 'f-e-t-c-h'

// inside an aync function
const result = await F.patch('http://example.com/posts', {
  params: { id: 1 },
  json: { title: 'New Post' },
}).json()

console.log(result)
// → { userId: 1, id: 1, title: 'New Post', body: 'Some text', }
```

## 💻 Usage

### Create instance

```js
const api = F.create({
  prefixUrl: 'https://jsonplaceholder.typicode.com/',
  headers: {
    Authorization: 'Bearer 943b1a29b46248b29336164d9ec5f217',
  },
})
```

### Search params

```js
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

> This feature may require polyfill for [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController.html) and `fetch`.

Cancel request if it is not fulfilled in period of time.

```js
import { isTimeout } from 'f-e-t-c-h'

api
  .get('/posts', { timeout: 300 })
  .json()
  .then((posts) => console.log(posts))
  .catch((error) => {
    if (isTimeout(error)) {
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
import { isAborted } from 'f-e-t-c-h'
import { useEffect, useState } from 'react'

export function usePosts() {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    const controller = new AbortController()

    api
      .get('/posts', { signal: controller.signal })
      .json()
      .then((data) => setPosts(data))
      .catch((error) => {
        if (isAborted(error)) {
          // do something
        }
      })

    return () => controller.abort()
  }, [setPosts])

  return posts
}
```

## 📖 API

### Instance

`F.create(options?: Options): Instance` <br>
`F.extend(options?: Options): Instance` <br>
`F.options: Options`

### Methods

<details><summary><code>F(resource: string, options?: Options): Request</code> (alias to <code>.get</code>)</summary>

```js
fetch(resource, { method: 'GET', ...options })
```

</details>
<details><summary><code>F.get(resource: string, options?: Options): Request</code></summary>

```js
fetch(resource, { method: 'GET', ...options })
```

</details>
<details><summary><code>F.post(resource: string, options?: Options): Request</code></summary>

```js
fetch(resource, { method: 'POST', ...options })
```

</details>
<details><summary><code>F.put(resource: string, options?: Options): Request</code></summary>

```js
fetch(resource, { method: 'PUT', ...options })
```

</details>
<details><summary><code>F.patch(resource: string, options?: Options): Request</code></summary>

```js
fetch(resource, { method: 'PATCH', ...options })
```

</details>
<details><summary><code>F.delete(resource: string, options?: Options): Request</code></summary>

```js
fetch(resource, { method: 'DELETE', ...options })
```

</details>
<details><summary><code>F.head(resource: string, options?: Options): Request</code></summary>

```js
fetch(resource, { method: 'HEAD', ...options })
```

</details>

### Options

```ts
interface Options extends RequestInit {
  json?: unknown
  params?: unknown
  timeout?: number
  prefixUrl?: string
  headers?: Record<string, string>
  onResponse?(response: Response): Response
  serialize?(params: unknown): string
}
```

### Request

```ts
interface Request extends Promise<Response> {
  json?<T>(): Promise<T>
  text?(): Promise<string>
  blob?(): Promise<Blob>
  arrayBuffer?(): Promise<ArrayBuffer>
  formData?(): Promise<FormData>
}
```

## 🔗 Alternatives

- [`ky`](https://github.com/sindresorhus/ky) - Library that inspired this one, but twice the size and not transpiled for old browsers
- [`axios`](https://github.com/axios/axios) - Based on old `XMLHttpRequests` API, 4x times bigger, but feature packed

---

MIT © [John Grishin](http://johngrish.in)
