import nock from 'nock'
import SimplerFetch, { isTimeout, isAborted } from './index'

afterEach(() => nock.cleanAll())

describe('Instance', () => {
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

    expect(fetch).toEqual(fetch.get)
    expect(fetch.options).toBeUndefined()
  })

  test('should prepend prefixUrl with create options', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200, [1, 2, 3, 4])

    const api = SimplerFetch.create({ prefixUrl: 'http://localhost' })
    const result = await api.get('/comments').json()

    expect(result).toEqual([1, 2, 3, 4])
    scope.done()
  })

  test.todo('should extend instance')

  test('default request method should be GET', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200, [1, 2, 3, 4])

    const result = await SimplerFetch('http://localhost/comments').json()

    expect(result).toEqual([1, 2, 3, 4])
    scope.done()
  })

  test('should transform `params` to query string', async () => {
    const scope = nock('http://localhost')
      .get('/comments?userId=1')
      .reply(200, 'ok')

    const result = await SimplerFetch.get('http://localhost/comments', {
      params: { userId: 1 },
    }).text()

    expect(result).toBe('ok')
    scope.done()
  })
})

describe('Response', () => {
  test('request should return `Response` object by default', async () => {
    const scope = nock('http://localhost')
      .get('/comments')
      .reply(200)

    const result = await SimplerFetch.get('http://localhost/comments')

    expect(result).toBeInstanceOf(Response)
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
      .get('/comments')
      .reply(200, data)

    const result = await SimplerFetch.get('http://localhost/comments').json()

    expect(result).toEqual(data)
    scope.done()
  })

  test('request should return `text`', async () => {
    const scope = nock('http://localhost')
      .matchHeader('accept', 'text/*')
      .get('/comments')
      .reply(200, 'ok')

    const result = await SimplerFetch.get('http://localhost/comments').text()

    expect(result).toBe('ok')
    scope.done()
  })

  test('request should return `arrayBuffer`', async () => {
    const scope = nock('http://localhost')
      .matchHeader('accept', '*/*')
      .get('/blob')
      .reply(200, 'test')

    const result = await SimplerFetch.get('http://localhost/blob').arrayBuffer()

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

    const result = await SimplerFetch.get('http://localhost/blob').blob()

    // @ts-ignore
    expect(await result.text()).toBe('test')
    expect(result.size).toBe(4)
    expect(result.type).toBeDefined()
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
      await SimplerFetch.get('http://localhost/comments', { timeout: 10 })
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

    await SimplerFetch.get('http://localhost/comments', { timeout: 20 })
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
      await SimplerFetch.get('http://localhost/comments', {
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
      await SimplerFetch.get('http://localhost/comments', {
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
      await SimplerFetch.get('http://localhost/comments', {
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
      const scope = nock('http://localhost')
        .get('/comments')
        .reply(200, 'ok')

      const result = await SimplerFetch.get('http://localhost/comments').text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed get request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost')
        .get('/comments')
        .reply(400)

      try {
        await SimplerFetch.get('http://localhost/comments')
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

      const result = await SimplerFetch.post('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success post `formData` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', 'multipart/form-data')
        .post('/comments', /form-data; name="user"[\r\n]*test/)
        .reply(200, 'ok')

      const body = new FormData()
      body.append('user', 'test')

      const result = await SimplerFetch.post('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success post `text` request', async () => {
      const scope = nock('http://localhost')
        .post('/comments', 'data')
        .reply(200, 'ok')

      const result = await SimplerFetch.post('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed post request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost')
        .post('/comments')
        .reply(400)

      try {
        await SimplerFetch.post('http://localhost/comments')
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

      const result = await SimplerFetch.put('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success put `formData` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', 'multipart/form-data')
        .put('/comments', /form-data; name="user"[\r\n]*test/)
        .reply(200, 'ok')

      const body = new FormData()
      body.append('user', 'test')

      const result = await SimplerFetch.put('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success put `text` request', async () => {
      const scope = nock('http://localhost')
        .put('/comments', 'data')
        .reply(200, 'ok')

      const result = await SimplerFetch.put('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed put request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost')
        .put('/comments')
        .reply(400)

      try {
        await SimplerFetch.put('http://localhost/comments')
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

      const result = await SimplerFetch.patch('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success patch `formData` request', async () => {
      const scope = nock('http://localhost')
        .matchHeader('content-type', 'multipart/form-data')
        .patch('/comments', /form-data; name="user"[\r\n]*test/)
        .reply(200, 'ok')

      const body = new FormData()
      body.append('user', 'test')

      const result = await SimplerFetch.patch('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should perform success patch `text` request', async () => {
      const scope = nock('http://localhost')
        .patch('/comments', 'data')
        .reply(200, 'ok')

      const result = await SimplerFetch.patch('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed patch request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost')
        .patch('/comments')
        .reply(400)

      try {
        await SimplerFetch.patch('http://localhost/comments')
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

      const result = await SimplerFetch.delete(
        'http://localhost/comments/1'
      ).text()

      expect(result).toBe('ok')
      scope.done()
    })

    test('should throw `ResponseError` on failed delete request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost')
        .delete('/comments/1')
        .reply(400)

      try {
        await SimplerFetch.delete('http://localhost/comments/1')
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
      const scope = nock('http://localhost')
        .head('/comments/1')
        .reply(200)

      const response = await SimplerFetch.head('http://localhost/comments/1')

      expect(response.status).toBe(200)
      scope.done()
    })

    test('should throw `ResponseError` on failed head request', async () => {
      expect.assertions(3)

      const scope = nock('http://localhost')
        .head('/comments/1')
        .reply(400)

      try {
        await SimplerFetch.head('http://localhost/comments/1')
      } catch (error) {
        expect(error.name).toBe('ResponseError')
        expect(error.response).toBeInstanceOf(Response)
        expect(error.response.status).toBe(400)
      }

      scope.done()
    })
  })
})
