import nock from 'nock'
import queryString from 'query-string'
import YF, {
  ResponseError,
  isTimeout,
  isResponseError,
  isTimeoutError,
  isAborted,
  isAbortError,
} from './index'

afterEach(() => nock.cleanAll())

describe('Instance', () => {
  test('should create new instance', () => {
    const api = YF.create()

    expect(api).toBeInstanceOf(Function)
    expect(api.create).toBeInstanceOf(Function)
    expect(api.extend).toBeInstanceOf(Function)
    expect(api.get).toBeInstanceOf(Function)
    expect(api.post).toBeInstanceOf(Function)
    expect(api.put).toBeInstanceOf(Function)
    expect(api.patch).toBeInstanceOf(Function)
    expect(api.delete).toBeInstanceOf(Function)
    expect(api.head).toBeInstanceOf(Function)

    expect(api).toEqual(api.get)
    expect(api.options).toBeUndefined()
  })

  test('should prepend prefixUrl with create options', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200, [1, 2, 3, 4])

    const api = YF.create({ prefixUrl: 'http://localhost' })
    const result = await api.get('/comments').json<number[]>()

    expect(result).toEqual([1, 2, 3, 4])
    scope.done()
  })

  test('should extend instance with new options', async () => {
    const base = YF.create({ prefixUrl: 'http://localhost' })
    expect(base.options.prefixUrl).toBe('http://localhost')

    const extended = base.extend({
      headers: {
        Authorization: 'Bearer ::Token::',
      },
    })

    expect(extended.options.prefixUrl).toBe('http://localhost')
    expect(extended.options.headers.Authorization).toBe('Bearer ::Token::')

    const scope = nock('http://localhost')
      .matchHeader('Authorization', 'Bearer ::Token::')
      .get('/comments')
      .reply(200)

    await extended.get('/comments')
    scope.done()
  })

  test('should be possible to modify options in instance', async () => {
    const api = YF.create({ prefixUrl: 'http://localhost' })
    expect(api.options.prefixUrl).toBe('http://localhost')

    api.options.prefixUrl = 'https://example.com'
    api.options.headers = { Authorization: 'Bearer ::Token::' }

    expect(api.options.prefixUrl).toBe('https://example.com')
    expect(api.options.headers.Authorization).toBe('Bearer ::Token::')

    const scope = nock('https://example.com')
      .matchHeader('Authorization', 'Bearer ::Token::')
      .get('/comments')
      .reply(200)

    await api.get('/comments')
    scope.done()
  })

  test('default request method should be GET', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200, [1, 2, 3, 4])

    const result = await YF('http://localhost/comments').json()

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

  test('should merge `params` from instance and tranform to query string', async () => {
    const scope = nock('http://localhost')
      .get('/comments?userId=1&accessToken=1')
      .reply(200, 'ok')

    const api = YF.create({
      prefixUrl: 'http://localhost',
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
      prefixUrl: 'http://localhost',
      onJSON: (parsed: { data: Comments }) => parsed.data,
    })

    const result = await api('/comments').json<Comments>()

    expect(result).toEqual([1, 2, 3, 4])
    scope.done()
  })

  test('should be able to return custom error `onFailure`', async () => {
    enum ERRORS {
      'Foo Error' = 100,
    }

    const scope = nock('http://localhost')
      .get('/comments')
      .reply(403, { errorCode: 100 })

    const api = YF.create({
      prefixUrl: 'http://localhost',
      onFailure: async (error, opts) => {
        if (isResponseError(error)) {
          if (error.response.status === 403) {
            const parsed = (await error.response.json()) as {
              errorCode: ERRORS
            }

            throw ResponseError(error.response, ERRORS[parsed.errorCode])
          }
        }

        throw error
      },
    })

    try {
      await api('/comments')
    } catch (error) {
      expect(error.message).toEqual('Foo Error')
    }

    scope.done()
  })

  test('should be possible to use custom `serialize` function', async () => {
    const scope = nock('http://localhost')
      .get('/comments?accessToken=1&users[]=1&users[]=2&users[]=3')
      .reply(200, 'ok')

    const api = YF.create({
      prefixUrl: 'http://localhost',
      params: { accessToken: '1' },
      serialize(params) {
        return queryString.stringify(params, { arrayFormat: 'bracket' })
      },
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

    // @ts-ignore
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

    // @ts-ignore
    expect(await result.text()).toBe('test')
    expect(result.size).toBe(4)
    expect(result.type).toBeDefined()
    scope.done()
  })

  test('should be possible to get headers with a function', async () => {
    const scope = nock('https://example.com')
    const state = { token: 'none' }
    const api = YF.create({
      prefixUrl: 'https://example.com',
      getHeaders: () => ({ Authorization: `Bearer ${state.token}` }),
    })

    scope
      .get('/comments')
      .matchHeader('Authorization', 'Bearer token-1')
      .reply(200)
    state.token = 'token-1'
    await api.get('/comments')

    scope
      .get('/users')
      .matchHeader('Authorization', 'Bearer token-2')
      .reply(200)
    state.token = 'token-2'
    await api.get('/users')

    scope.done()
  })

  test('should be possible to get headers with an async function', async () => {
    const scope = nock('https://example.com')
    const state = { token: 'none' }
    const api = YF.create({
      prefixUrl: 'https://example.com',
      getHeaders: async () => {
        await new Promise((resolve) => setTimeout(resolve, 32))
        return { Authorization: `Bearer ${state.token}` }
      },
    })

    scope
      .get('/comments')
      .matchHeader('Authorization', 'Bearer token-1')
      .reply(200)
    state.token = 'pre-token-1'
    setTimeout(() => {
      state.token = 'token-1'
    }, 16)
    await api.get('/comments')

    scope
      .get('/users')
      .matchHeader('Authorization', 'Bearer token-2')
      .reply(200)
    state.token = 'pre-token-2'
    setTimeout(() => {
      state.token = 'token-2'
    }, 16)
    await api.get('/users')

    scope.done()
  })
})

describe('Timeout', () => {
  test('should throw if timeout is passed', async () => {
    expect.assertions(2)

    const scope = nock('http://localhost')
      .get('/comments')
      .delayConnection(20)
      .reply(200)

    try {
      await YF.get('http://localhost/comments', { timeout: 10 })
    } catch (error) {
      expect(error.name).toBe('TimeoutError')
      expect(isTimeout(error)).toBe(true)
    }

    scope.done()
  })

  test('should fullfil if timeout is smaller than delay', async () => {
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
    expect.assertions(2)

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
      expect(error.name).toBe('AbortError')
      expect(isAborted(error)).toBe(true)
    }

    scope.done()
  })

  test('AbortController should cancel request with timeout', async () => {
    expect.assertions(2)

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
      expect(error.name).toBe('AbortError')
      expect(isAborted(error)).toBe(true)
    }

    scope.done()
  })

  test('AbortController should cancel request before timeout', async () => {
    expect.assertions(2)

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
      expect(error.name).toBe('TimeoutError')
      expect(isTimeout(error)).toBe(true)
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
        expect(error.name).toBe('ResponseError')
        expect(error.response).toBeInstanceOf(Response)
        expect(error.response.status).toBe(400)
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
        expect(error.name).toBe('ResponseError')
        expect(error.response).toBeInstanceOf(Response)
        expect(error.response.status).toBe(400)
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
        expect(error.name).toBe('ResponseError')
        expect(error.response).toBeInstanceOf(Response)
        expect(error.response.status).toBe(400)
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
        expect(error.name).toBe('ResponseError')
        expect(error.response).toBeInstanceOf(Response)
        expect(error.response.status).toBe(400)
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
        expect(error.name).toBe('ResponseError')
        expect(error.response).toBeInstanceOf(Response)
        expect(error.response.status).toBe(400)
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
        expect(error.name).toBe('ResponseError')
        expect(error.response).toBeInstanceOf(Response)
        expect(error.response.status).toBe(400)
      }

      scope.done()
    })
  })
})

describe('compatibility', () => {
  test('renamed `isTimeout` should be same as `isTimeoutError`', () => {
    expect(isTimeout).toBe(isTimeoutError)
  })

  test('renamed `isTimeout` should be same as `isTimeoutError`', () => {
    expect(isAborted).toBe(isAbortError)
  })
})
