import { afterEach, describe, test, expect } from 'vitest'
import nock from 'nock'
import queryString from 'query-string'
import * as YF from '../src/index.js'

afterEach(() => nock.cleanAll())

describe('Instance', () => {
  test('should create new instance', () => {
    const api = YF.create()

    expect(api.extend).toBeInstanceOf(Function)
    expect(api.get).toBeInstanceOf(Function)
    expect(api.post).toBeInstanceOf(Function)
    expect(api.put).toBeInstanceOf(Function)
    expect(api.patch).toBeInstanceOf(Function)
    expect(api.delete).toBeInstanceOf(Function)
    expect(api.head).toBeInstanceOf(Function)
  })

  test('should prepend resource with create options', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200, [1, 2, 3, 4])

    const api = YF.create({ resource: 'http://localhost' })
    const result = await api.get('/comments').json<number[]>()

    expect(result).toEqual([1, 2, 3, 4])
    scope.done()
  })

  test('should extend instance with new options', async () => {
    const base = YF.create({ resource: 'http://localhost' })

    const extended = base.extend({
      headers: {
        Authorization: 'Bearer ::Token::',
      },
    })

    const scope = nock('http://localhost')
      .matchHeader('Authorization', 'Bearer ::Token::')
      .get('/comments')
      .reply(200)

    await extended.get('/comments')
    scope.done()
  })

  test('default request method should be GET', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200, [1, 2, 3, 4])

    const result = await YF.get('http://localhost/comments').json()

    expect(result).toEqual([1, 2, 3, 4])
    scope.done()
  })

  test('should transform `params` to query string', async () => {
    const scope = nock('http://localhost')
      .get('/comments?userId=1')
      .reply(200, 'ok')

    const result = await YF.get('http://localhost/comments', {
      params: { userId: 1 },
    }).text()

    expect(result).toBe('ok')
    scope.done()
  })

  test('should merge `params` from instance and transform to query string', async () => {
    const scope = nock('http://localhost')
      .get('/comments?userId=1&accessToken=1')
      .reply(200, 'ok')

    const api = YF.create({
      resource: 'http://localhost',
      params: { accessToken: 1 },
    })

    const result = await api.get('/comments', { params: { userId: 1 } }).text()

    expect(result).toBe('ok')
    scope.done()
  })

  test('should modify `json` response with `onJSON` method', async () => {
    type Comments = number[]

    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200, { data: [1, 2, 3, 4] })

    const api = YF.create({
      resource: 'http://localhost',
      onJSON: (parsed: { data: Comments }) => parsed.data,
    })

    const result = await api.get('/comments').json<Comments>()

    expect(result).toEqual([1, 2, 3, 4])
    scope.done()
  })

  test('should be able to return custom error `onFailure`', async () => {
    enum ErrorCode {
      'Foo Error' = 100,
    }

    class CustomResponseError extends YF.ResponseError {
      code: ErrorCode
      constructor(response: YF.Response, code: ErrorCode) {
        super(response, ErrorCode[code])
        this.code = code
      }
    }

    const scope = nock('http://localhost')
      .get('/comments')
      .reply(403, { errorCode: 100 })

    const api = YF.create({
      resource: 'http://localhost',
      async onFailure(error) {
        if (error instanceof YF.ResponseError) {
          if (error.response.status === 403) {
            const json = await error.response.json()

            if ('errorCode' in json) {
              throw new CustomResponseError(error.response, json.errorCode)
            }
          }
        }

        throw error
      },
    })

    try {
      await api.get('/comments')
    } catch (error) {
      if (error instanceof CustomResponseError) {
        expect(error.message).toEqual('Foo Error')
        expect(error.code).toEqual(ErrorCode['Foo Error'])
      }
    }

    scope.done()
  })

  test('return new `Response` inside `onFailure`', async () => {
    let count = 0
    const scope = nock('http://localhost')
      .persist()
      .get('/comments')
      .reply(() => {
        if (count < 5) {
          count++
          return [500]
        }

        return [200, 'OK']
      })

    const api = YF.create({
      resource: 'http://localhost',
      onFailure(error) {
        if (error instanceof YF.ResponseError) {
          if (error.response.status === 500 && count <= 5) {
            return YF.request(error.response.options)
          } else if (error.response.ok) {
            return error.response
          }
        }

        throw error
      },
    })

    const result = await api.get('/comments').text()

    expect(count).toBe(5)
    expect(result).toBe('OK')

    scope.done()
  })

  test('return new `Response` inside `onResponse`', async () => {
    let count = 0
    const scope = nock('http://localhost')
      .persist()
      .get('/comments')
      .reply(() => {
        if (count < 5) {
          count++
          return [500]
        }

        return [200, 'OK']
      })

    const api = YF.create({
      resource: 'http://localhost',
      onResponse(response) {
        if (response.status === 500 && count <= 5) {
          return YF.request(response.options)
        } else if (response.ok) {
          return response
        }

        throw new YF.ResponseError(response)
      },
    })

    const result = await api.get('/comments').text()

    expect(count).toBe(5)
    expect(result).toBe('OK')

    scope.done()
  })

  test('should be possible to use custom `serialize` function', async () => {
    const scope = nock('http://localhost')
      .get('/comments?accessToken=1&users[]=1&users[]=2&users[]=3')
      .reply(200, 'ok')

    const api = YF.create({
      resource: 'http://localhost',
      params: {
        accessToken: '1',
      },
      serialize: (params) =>
        queryString.stringify(params, { arrayFormat: 'bracket' }),
    })

    const result = await api
      .get('/comments', { params: { users: [1, 2, 3] } })
      .text()

    expect(result).toBe('ok')
    scope.done()
  })
})

describe('Response', () => {
  test('request should return `Response` object by default', async () => {
    const scope = nock('http://localhost').get('/comments').reply(200)

    const result = await YF.get('http://localhost/comments')

    expect(result).toBeInstanceOf(Response)
    scope.done()
  })

  test('request should return `json`', async () => {
    const data = {
      firstName: 'Ivan',
      lastName: 'Grishin',
      items: [
        { id: 1, name: 'Backpack' },
        { id: 2, name: 'Laptop' },
      ],
    }

    const scope = nock('http://localhost')
      .matchHeader('accept', 'application/json')
      .get('/comments')
      .reply(200, data)

    const result = await YF.get('http://localhost/comments').json()

    expect(result).toEqual(data)
    scope.done()
  })

  test('request should return `text`', async () => {
    const scope = nock('http://localhost')
      .matchHeader('accept', 'text/*')
      .get('/comments')
      .reply(200, 'ok')

    const result = await YF.get('http://localhost/comments').text()

    expect(result).toBe('ok')
    scope.done()
  })

  test('request should return `arrayBuffer`', async () => {
    const scope = nock('http://localhost')
      .matchHeader('accept', '*/*')
      .get('/blob')
      .reply(200, 'test')

    const result = await YF.get('http://localhost/blob').arrayBuffer()

    expect(String.fromCharCode(...new Uint8Array(result))).toBe('test')
    expect(result.byteLength).toBe(4)
    expect(result).toBeInstanceOf(ArrayBuffer)
    scope.done()
  })

  test('request should return `blob`', async () => {
    const scope = nock('http://localhost')
      .matchHeader('accept', '*/*')
      .get('/blob')
      .reply(200, 'test')

    const result = await YF.get('http://localhost/blob').blob()

    expect(await result.text()).toBe('test')
    expect(result.size).toBe(4)
    expect(result.type).toBeDefined()
    scope.done()
  })

  test('should be possible to set headers with a function', async () => {
    let token = 'none'

    const scope = nock('https://example.com')
    const api = YF.create({
      resource: 'https://example.com',
      onRequest(url, options) {
        options.headers.set('Authorization', `Bearer ${token}`)
      },
    })

    scope
      .get('/comments')
      .matchHeader('Authorization', 'Bearer token-1')
      .reply(200)
    token = 'token-1'
    await api.get('/comments')

    scope
      .get('/users')
      .matchHeader('Authorization', 'Bearer token-2')
      .reply(200)
    token = 'token-2'
    await api.get('/users')

    scope.done()
  })

  test('should be possible to set headers with an async function', async () => {
    let token = 'none'

    const scope = nock('https://example.com')
    const api = YF.create({
      resource: 'https://example.com',
      headers: { 'x-static': 'static value' },
      async onRequest(url, options) {
        expect(url).toBeInstanceOf(URL)
        expect(url.toString()).toBe(options.resource)
        expect(options.resource).toMatch(/example\.com\/(users|comments)/)
        expect(options.method).toBe('GET')
        expect(options.headers.get('x-static')).toEqual('static value')
        expect(options.headers.has('Authorization')).toEqual(false)

        await new Promise((resolve) => setTimeout(resolve, 32))
        options.headers.set('Authorization', `Bearer ${token}`)
      },
    })

    scope
      .get('/comments')
      .matchHeader('Authorization', 'Bearer token-1')
      .reply(200)

    token = 'pre-token-1'
    setTimeout(() => {
      token = 'token-1'
    }, 16)

    await api.get('/comments')

    scope
      .get('/users')
      .matchHeader('Authorization', 'Bearer token-2')
      .reply(200)

    token = 'pre-token-2'
    setTimeout(() => {
      token = 'token-2'
    }, 16)

    await api.get('/users')

    scope.done()
  })
})

describe('Timeout', () => {
  test('should throw if timeout is passed', async () => {
    expect.assertions(1)

    const scope = nock('http://localhost')
      .get('/comments')
      .delayConnection(20)
      .reply(200)

    try {
      await YF.get('http://localhost/comments', { timeout: 10 })
    } catch (error) {
      expect(error).toBeInstanceOf(YF.TimeoutError)
    }

    scope.done()
  })

  test('should resolve if timeout is smaller than delay', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .delayConnection(10)
      .reply(200)

    await YF.get('http://localhost/comments', { timeout: 20 })
    scope.done()
  })
})

describe('AbortController', () => {
  test('AbortController should cancel request', async () => {
    expect.assertions(1)

    const controller = new AbortController()

    const scope = nock('http://localhost')
      .get('/comments')
      .delayConnection(20)
      .reply(200)

    try {
      setTimeout(() => controller.abort(), 10)
      await YF.get('http://localhost/comments', {
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error) {
        expect(error.name).toBe('AbortError')
      }
    }

    scope.done()
  })

  test('AbortController should cancel request with timeout', async () => {
    expect.assertions(1)

    const controller = new AbortController()

    const scope = nock('http://localhost')
      .get('/comments')
      .delayConnection(20)
      .reply(200)

    try {
      setTimeout(() => controller.abort(), 10)
      await YF.get('http://localhost/comments', {
        signal: controller.signal,
        timeout: 15,
      })
    } catch (error) {
      if (error instanceof Error) {
        expect(error.name).toBe('AbortError')
      }
    }

    scope.done()
  })

  test('AbortController should cancel request before timeout', async () => {
    expect.assertions(1)

    const controller = new AbortController()

    const scope = nock('http://localhost')
      .get('/comments')
      .delayConnection(20)
      .reply(200)

    try {
      setTimeout(() => controller.abort(), 10)
      await YF.get('http://localhost/comments', {
        signal: controller.signal,
        timeout: 5,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(YF.TimeoutError)
    }

    scope.done()
  })
})

describe('Methods', () => {
  describe('GET', () => {
    test('should perform success get request', async () => {
      const scope = nock('http://localhost').get('/comments').reply(200, 'ok')

      const result = await YF.get('http://localhost/comments').text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed get request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost').get('/comments').reply(400)

      try {
        await YF.get('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      scope.done()
    })
  })

  describe('POST', () => {
    test('should perform success post `json` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', 'application/json')
        .post('/comments', { user: 'test' })
        .reply(200, 'ok')

      const result = await YF.post('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success post `formData` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', /^multipart\/form-data;/)
        .post('/comments', /form-data; name="user"[\r\n]*test/)
        .reply(200, 'ok')

      const body = new FormData()
      body.append('user', 'test')

      const result = await YF.post('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success post `text` request', async () => {
      const scope = nock('http://localhost')
        .post('/comments', 'data')
        .reply(200, 'ok')

      const result = await YF.post('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed post request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost').post('/comments').reply(400)

      try {
        await YF.post('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      scope.done()
    })
  })

  describe('PUT', () => {
    test('should perform success put `json` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', 'application/json')
        .put('/comments', { user: 'test' })
        .reply(200, 'ok')

      const result = await YF.put('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success put `formData` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', /^multipart\/form-data;/)
        .put('/comments', /form-data; name="user"[\r\n]*test/)
        .reply(200, 'ok')

      const body = new FormData()
      body.append('user', 'test')

      const result = await YF.put('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success put `text` request', async () => {
      const scope = nock('http://localhost')
        .put('/comments', 'data')
        .reply(200, 'ok')

      const result = await YF.put('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed put request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost').put('/comments').reply(400)

      try {
        await YF.put('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      scope.done()
    })
  })

  describe('PATCH', () => {
    test('should perform success patch `json` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', 'application/json')
        .patch('/comments', { user: 'test' })
        .reply(200, 'ok')

      const result = await YF.patch('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success patch `formData` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', /^multipart\/form-data;/)
        .patch('/comments', /form-data; name="user"[\r\n]*test/)
        .reply(200, 'ok')

      const body = new FormData()
      body.append('user', 'test')

      const result = await YF.patch('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success patch `text` request', async () => {
      const scope = nock('http://localhost')
        .patch('/comments', 'data')
        .reply(200, 'ok')

      const result = await YF.patch('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed patch request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost').patch('/comments').reply(400)

      try {
        await YF.patch('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      scope.done()
    })
  })

  describe('DELETE', () => {
    test('should perform success delete request', async () => {
      const scope = nock('http://localhost')
        .delete('/comments/1')
        .reply(200, 'ok')

      const result = await YF.delete('http://localhost/comments/1').text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed delete request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost').delete('/comments/1').reply(400)

      try {
        await YF.delete('http://localhost/comments/1')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      scope.done()
    })
  })

  describe('HEAD', () => {
    test('should perform success head request', async () => {
      const scope = nock('http://localhost').head('/comments/1').reply(200)

      const response = await YF.head('http://localhost/comments/1')

      expect(response.status).toBe(200)
      scope.done()
    })

    test('should throw `ResponseError` on failed head request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost').head('/comments/1').reply(400)

      try {
        await YF.head('http://localhost/comments/1')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      scope.done()
    })
  })
})

test('receive voided response', async () => {
  const scope = nock('http://localhost')
    .get('/comments')
    .reply(200, [1, 2, 3, 4])

  const result = await YF.get('http://localhost/comments').void()

  expect(result).toEqual(undefined)
  scope.done()
})

test('default serialize', () => {
  const result = YF.serialize({
    number: 0,
    string: 'text',
    array: [1, 'two', 3],
    null: null,
    undefined,
  }).toString()

  expect(result).toBe('number=0&string=text&array=1&array=two&array=3')

  const params = new URLSearchParams(result)

  expect(params.getAll('number')).toEqual(['0'])
  expect(params.getAll('string')).toEqual(['text'])
  expect(params.getAll('array')).toEqual(['1', 'two', '3'])
})

test('change base', async () => {
  const scope = nock('http://example.com').get('/foo').reply(200)
  await YF.get('/foo', { base: 'http://example.com' })

  scope.done()
})

test('throw if no base', async () => {
  await expect(YF.get('/foo')).rejects.toThrowError(
    new TypeError('Invalid URL')
  )
})

test('retry', async () => {
  const state = {
    limit: 3,
    count: 0,
  }

  const scope = nock('http://localhost')
    .persist()
    .get('/comments')
    .reply(() => {
      if (state.count < state.limit) {
        state.count += 1
        return [500]
      }

      return [200, 'OK']
    })

  const api = YF.create({
    resource: 'http://localhost',
    retry: (response, count) => count < state.limit && response.status === 500,
  })

  const result = await api.get('/comments').text()

  expect(state.count).toBe(state.limit)
  expect(result).toBe('OK')

  scope.done()
})

test('retry after header in seconds', async () => {
  const state = {
    limit: 1,
    count: 0,
    start: Date.now(),
  }

  const scope = nock('http://localhost')
    .persist()
    .get('/comments')
    .reply(() => {
      if (state.count < state.limit) {
        state.count += 1
        return [503, undefined, { 'Retry-After': 2 }]
      }

      return [200, 'OK']
    })

  const api = YF.create({
    resource: 'http://localhost',
    retry: (response, count) => count < state.limit && response.status === 503,
  })

  const result = await api.get('/comments').text()

  expect(Date.now() - state.start).toBeGreaterThan(2000)
  expect(state.count).toBe(state.limit)
  expect(result).toBe('OK')

  scope.done()
})

test('retry after header as date', async () => {
  const state = {
    limit: 1,
    count: 0,
    start: Date.now(),
  }

  const scope = nock('http://localhost')
    .persist()
    .get('/comments')
    .reply(() => {
      if (state.count < state.limit) {
        state.count += 1
        return [
          503,
          undefined,
          { 'Retry-After': new Date(Date.now() + 2000).toUTCString() },
        ]
      }

      return [200, 'OK']
    })

  const api = YF.create({
    resource: 'http://localhost',
    retry: (response, count) => count < state.limit && response.status === 503,
  })

  const result = await api.get('/comments').text()

  expect(Date.now() - state.start).toBeGreaterThan(1000)
  expect(state.count).toBe(state.limit)
  expect(result).toBe('OK')

  scope.done()
})

test('extend headers', async () => {
  const scope1 = nock('http://localhost')
    .matchHeader('x-from', 'website')
    .get('/posts')
    .reply(200, [])

  const instance = YF.create({
    headers: { 'x-from': 'website' },
  })

  const res1 = await instance.get('http://localhost/posts').json()

  expect(res1).toEqual([])
  scope1.done()

  const scope2 = nock('http://localhost')
    .matchHeader('x-from', 'website')
    .matchHeader('authorization', 'Bearer token')
    .post('/posts')
    .reply(200)

  const authorized = instance.extend({
    headers: { Authorization: 'Bearer token' },
  })

  const res2 = await authorized.post('http://localhost/posts').void()

  expect(res2).toEqual(undefined)
  scope2.done()
})

test('extend resource', async () => {
  const scope1 = nock('http://localhost').get('/posts').times(2).reply(200, [])

  const instance = YF.create({ resource: 'http://localhost' })
  const res1 = await instance.get('/posts').json()
  expect(res1).toEqual([])

  const postsApi = instance.extend({ resource: '/posts' })
  const res2 = await postsApi.get().json()
  expect(res2).toEqual([])

  scope1.done()

  const scope3 = nock('http://localhost')
    .post('/posts', { title: 'Hello' })
    .reply(200, 'ok')

  const res3 = await postsApi.post({ json: { title: 'Hello' } }).text()
  expect(res3).toBe('ok')

  scope3.done()
})
