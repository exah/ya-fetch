import nock from 'nock'
import SimplerFetch from './index'

test('should create new instance', () => {
  const fetch = SimplerFetch.create()

  expect(fetch).toBeInstanceOf(Function)
  expect(fetch.create).toBeInstanceOf(Function)
  expect(fetch.extend).toBeInstanceOf(Function)
  expect(fetch.get).toBeInstanceOf(Function)
  expect(fetch.post).toBeInstanceOf(Function)
  expect(fetch.put).toBeInstanceOf(Function)
  expect(fetch.patch).toBeInstanceOf(Function)
  expect(fetch.delete).toBeInstanceOf(Function)
  expect(fetch.head).toBeInstanceOf(Function)

  expect(fetch.options).toBeUndefined()
})

test('should prepend prefixUrl with create options', async () => {
  const scope = nock('http://localhost')
    .get('/posts')
    .reply(200, [1, 2, 3, 4])

  const api = SimplerFetch.create({ prefixUrl: 'http://localhost' })
  const result = await api.get('/posts').json()

  expect(result).toEqual([1, 2, 3, 4])
  scope.done()
})

test.todo('should extend instance')

test('default request method should be GET', async () => {
  const scope = nock('http://localhost')
    .get('/posts')
    .reply(200, [1, 2, 3, 4])

  const result = await SimplerFetch('http://localhost/posts').json()

  expect(result).toEqual([1, 2, 3, 4])
  scope.done()
})

test('should transform `params` to query string', async () => {
  const scope = nock('http://localhost')
    .get('/posts?userId=1')
    .reply(200, 'ok')

  const result = await SimplerFetch.get('http://localhost/posts', {
    params: { userId: 1 },
  }).text()

  expect(result).toBe('ok')
  scope.done()
})

test('request should return `json`', async () => {
  const data = {
    firstName: 'Ivan',
    lastName: 'Grishin',
    items: [{ id: 1, name: 'Backpack' }, { id: 2, name: 'Laptop' }],
  }

  const scope = nock('http://localhost')
    .matchHeader('accept', 'application/json')
    .get('/posts')
    .reply(200, data)

  const result = await SimplerFetch.get('http://localhost/posts').json()

  expect(result).toEqual(data)
  scope.done()
})

test.todo('request should send `json`')

test.todo('request should return `formData`')

test('request should return `text`', async () => {
  const scope = nock('http://localhost')
    .matchHeader('accept', 'text/*')
    .get('/posts')
    .reply(200, 'ok')

  const result = await SimplerFetch.get('http://localhost/posts').text()

  expect(result).toBe('ok')
  scope.done()
})

test.todo('response arrayBuffer')
test.todo('response blob')

test.todo('timeout')
test.todo('cancel')

test.todo('get')
test.todo('post')
test.todo('put')
test.todo('patch')
test.todo('delete')
test.todo('head')
