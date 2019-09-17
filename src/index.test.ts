import nock from 'nock'
import SimplerFetch from './index'

const server = nock('http://localhost')

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
  const api = SimplerFetch.create({ prefixUrl: 'http://localhost' })

  const scope = server.get('/posts').reply(200, [1, 2, 3, 4])
  const result = await api.get('/posts').json()

  expect(result).toEqual([1, 2, 3, 4])
  scope.done()
})

test.todo('should extend instance')

test('default request method should be GET', async () => {
  const scope = server.get('/posts').reply(200, [1, 2, 3, 4])
  const result = await SimplerFetch('http://localhost/posts').json()

  expect(result).toEqual([1, 2, 3, 4])
  scope.done()
})

test.todo('request params')
test.todo('request json')

test.todo('response json')
test.todo('response formData')
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
