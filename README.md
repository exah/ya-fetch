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

## 📖 Usage

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

### Send & Receive JSON

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

## 🔗 Alternatives

- [`ky`](https://github.com/sindresorhus/ky) - Library that inspired this one, but twice the size and not transpiled for old browsers
- [`axios`](https://github.com/axios/axios) - Based on old `XMLHttpRequests` API, 4x times bigger, but feature packed

---

MIT © [John Grishin](http://johngrish.in)
