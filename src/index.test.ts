import nock from 'nock'
import SimplerFetch, { isTimeout, isAborted } from './index'

afterEach(() => nock.cleanAll())

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

test('should throw if timeout is passed', async () => {
  expect.assertions(2)

  const scope = nock('http://localhost')
    .get('/posts')
    .delayConnection(20)
    .reply(200)

  try {
    await SimplerFetch.get('http://localhost/posts', { timeout: 10 })
  } catch (error) {
    expect(error.name).toBe('TimeoutError')
    expect(isTimeout(error)).toBe(true)
  }

  scope.done()
})

test('should fullfil if timeout is smaller than delay', async () => {
  const scope = nock('http://localhost')
    .get('/posts')
    .delayConnection(10)
    .reply(200)

  await SimplerFetch.get('http://localhost/posts', { timeout: 20 })
  scope.done()
})

test('AbortController should cancel request', async () => {
  expect.assertions(2)

  const controller = new AbortController()

  const scope = nock('http://localhost')
    .get('/posts')
    .delayConnection(20)
    .reply(200)

  try {
    setTimeout(() => controller.abort(), 10)
    await SimplerFetch.get('http://localhost/posts', {
      signal: controller.signal,
    })
  } catch (error) {
    expect(error.name).toBe('AbortError')
    expect(isAborted(error)).toBe(true)
  }

  scope.done()
})

test('AbortController should cancel request with timeout', async () => {
  expect.assertions(2)

  const controller = new AbortController()

  const scope = nock('http://localhost')
    .get('/posts')
    .delayConnection(20)
    .reply(200)

  try {
    setTimeout(() => controller.abort(), 10)
    await SimplerFetch.get('http://localhost/posts', {
      signal: controller.signal,
      timeout: 15,
    })
  } catch (error) {
    expect(error.name).toBe('AbortError')
    expect(isAborted(error)).toBe(true)
  }

  scope.done()
})

test('AbortController should cancel request before timeout', async () => {
  expect.assertions(2)

  const controller = new AbortController()

  const scope = nock('http://localhost')
    .get('/posts')
    .delayConnection(20)
    .reply(200)

  try {
    setTimeout(() => controller.abort(), 10)
    await SimplerFetch.get('http://localhost/posts', {
      signal: controller.signal,
      timeout: 5,
    })
  } catch (error) {
    expect(error.name).toBe('TimeoutError')
    expect(isTimeout(error)).toBe(true)
  }

  scope.done()
})

test.todo('get')
test.todo('post')
test.todo('put')
test.todo('patch')
test.todo('delete')
test.todo('head')
