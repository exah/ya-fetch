import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  test,
  expect,
  vi,
} from 'vitest'
import { http, delay, type ResponseResolver } from 'msw'
import { setupServer } from 'msw/node'
import queryString from 'query-string'
import * as YF from '../src/index.js'

const server = setupServer()

beforeAll(() => server.listen())
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

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
    const endpoint = vi.fn(() => Response.json([1, 2, 3, 4]))
    server.use(http.get('http://localhost/comments', endpoint))

    const api = YF.create({ resource: 'http://localhost' })
    const result = await api.get('/comments').json<number[]>()

    expect(result).toEqual([1, 2, 3, 4])
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('should extend instance with new options', async () => {
    const endpoint = vi.fn(() => new Response())
    server.use(http.get('http://localhost/comments', endpoint))

    const base = YF.create({ resource: 'http://localhost' })

    const extended = base.extend({
      headers: {
        Authorization: 'Bearer ::Token::',
      },
    })

    await extended.get('/comments')

    expect(endpoint).toHaveBeenCalledTimes(1)
    expect(endpoint.mock.calls[0]).toSatisfy(
      ([{ request }]: Parameters<ResponseResolver>) =>
        request.headers.get('Authorization') === 'Bearer ::Token::'
    )
  })

  test('default request method should be GET', async () => {
    const endpoint = vi.fn(() => Response.json([1, 2, 3, 4]))

    server.use(http.get('http://localhost/comments', endpoint))

    const result = await YF.get('http://localhost/comments').json()

    expect(result).toEqual([1, 2, 3, 4])
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('should transform `params` to query string', async () => {
    const endpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) => {
      const url = new URL(request.url)

      if (url.searchParams.get('userId') === '1') {
        return new Response('ok')
      }

      return new Response('Invalid request', { status: 400 })
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const result = await YF.get('http://localhost/comments', {
      params: { userId: 1 },
    }).text()

    expect(result).toBe('ok')
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('should merge `params` from instance and transform to query string', async () => {
    const endpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) => {
      const url = new URL(request.url)

      if (
        url.searchParams.get('userId') === '1' &&
        url.searchParams.get('accessToken') === '1'
      ) {
        return new Response('ok')
      }

      return new Response('Invalid request', { status: 400 })
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const api = YF.create({
      resource: 'http://localhost',
      params: { accessToken: 1 },
    })

    const result = await api.get('/comments', { params: { userId: 1 } }).text()

    expect(result).toBe('ok')
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('should modify `json` response with `onJSON` method', async () => {
    const endpoint = vi.fn(() => Response.json({ data: [1, 2, 3, 4] }))
    server.use(http.get('http://localhost/comments', endpoint))

    const api = YF.create({
      resource: 'http://localhost',
      onJSON: (parsed: { data: number[] }) => parsed.data,
    })

    const result = await api.get('/comments').json<number[]>()

    expect(result).toEqual([1, 2, 3, 4])
    expect(endpoint).toHaveBeenCalledTimes(1)
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

    const endpoint = vi.fn(() =>
      Response.json({ errorCode: ErrorCode['Foo Error'] }, { status: 403 })
    )
    server.use(http.get('http://localhost/comments', endpoint))

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

    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('return new `Response` inside `onFailure`', async () => {
    const times = 6
    let count = 0

    const endpoint = vi.fn(() => {
      if (count < 5) {
        count++
        return new Response(null, { status: 500 })
      }

      return new Response('OK')
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const api = YF.create({
      resource: 'http://localhost',
      onFailure(error) {
        if (error instanceof YF.ResponseError) {
          if (error.response.status === 500 && count < times) {
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
    expect(endpoint).toHaveBeenCalledTimes(6)
  })

  test('return new `Response` inside `onResponse`', async () => {
    const times = 6
    let count = 0

    const endpoint = vi.fn(() => {
      if (count < 5) {
        count++
        return new Response(null, { status: 500 })
      }

      return new Response('OK')
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const api = YF.create({
      resource: 'http://localhost',
      onResponse(response) {
        if (response.status === 500 && count < times) {
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
    expect(endpoint).toHaveBeenCalledTimes(6)
  })

  test('should be possible to use custom `serialize` function', async () => {
    const endpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) => {
      const url = new URL(request.url)

      if (
        url.search ===
        '?accessToken=1&users%5B%5D=1&users%5B%5D=2&users%5B%5D=3'
      ) {
        return new Response('ok')
      }

      return new Response('Invalid request', { status: 400 })
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const api = YF.create({
      resource: 'http://localhost',
      params: { accessToken: '1' },
      serialize: (params) =>
        queryString.stringify(params, { arrayFormat: 'bracket' }),
    })

    const result = await api
      .get('/comments', { params: { users: [1, 2, 3] } })
      .text()

    expect(result).toBe('ok')
    expect(endpoint).toHaveBeenCalledTimes(1)
  })
})

describe('Response', () => {
  test('request should return `Response` object by default', async () => {
    const endpoint = vi.fn(() => new Response())
    server.use(http.get('http://localhost/comments', endpoint))

    const result = await YF.get('http://localhost/comments')

    expect(result).toBeInstanceOf(Response)
    expect(endpoint).toHaveBeenCalledTimes(1)
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

    const endpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
      request.headers.get('accept') === 'application/json'
        ? Response.json(data)
        : Response.error()
    )

    server.use(http.get('http://localhost/comments', endpoint))
    const result = await YF.get('http://localhost/comments').json()

    expect(result).toEqual(data)
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('request should return `text`', async () => {
    const endpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
      request.headers.get('accept') === 'text/*'
        ? new Response('ok')
        : Response.error()
    )

    server.use(http.get('http://localhost/comments', endpoint))

    const result = await YF.get('http://localhost/comments').text()

    expect(result).toBe('ok')
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('request should return `arrayBuffer`', async () => {
    const endpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
      request.headers.get('accept') === '*/*'
        ? new Response('test')
        : Response.error()
    )

    server.use(http.get('http://localhost/blob', endpoint))

    const result = await YF.get('http://localhost/blob').arrayBuffer()

    expect(String.fromCharCode(...new Uint8Array(result))).toBe('test')
    expect(result.byteLength).toBe(4)
    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('request should return `blob`', async () => {
    const endpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
      request.headers.get('accept') === '*/*'
        ? new Response('test')
        : Response.error()
    )
    server.use(http.get('http://localhost/blob', endpoint))

    const result = await YF.get('http://localhost/blob').blob()

    expect(await result.text()).toBe('test')
    expect(result.size).toBe(4)
    expect(result.type).toBeDefined()
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('should be possible to set headers with a function', async () => {
    const commentsEndpoint = vi.fn<Parameters<ResponseResolver>>(
      ({ request }) =>
        request.headers.get('Authorization') === 'Bearer token-1'
          ? new Response()
          : Response.error()
    )

    const usersEndpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-2'
        ? new Response()
        : Response.error()
    )

    server.use(
      http.get('https://example.com/comments', commentsEndpoint),
      http.get('https://example.com/users', usersEndpoint)
    )

    let token: string
    const api = YF.create({
      resource: 'https://example.com',
      onRequest(_, options) {
        options.headers.set('Authorization', `Bearer ${token}`)
      },
    })

    token = 'token-1'
    await api.get('/comments')

    token = 'token-2'
    await api.get('/users')

    expect(commentsEndpoint).toHaveBeenCalledTimes(1)
    expect(usersEndpoint).toHaveBeenCalledTimes(1)
  })

  test('should be possible to set headers with an async function', async () => {
    const commentsEndpoint = vi.fn<Parameters<ResponseResolver>>(
      ({ request }) =>
        request.headers.get('Authorization') === 'Bearer token-1'
          ? new Response()
          : Response.error()
    )

    const usersEndpoint = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-2'
        ? new Response()
        : Response.error()
    )

    server.use(
      http.get('https://example.com/comments', commentsEndpoint),
      http.get('https://example.com/users', usersEndpoint)
    )

    let token: string
    const api = YF.create({
      resource: 'https://example.com',
      headers: { 'x-static': 'static value' },
      async onRequest(url, options) {
        expect(url).toBeInstanceOf(URL)
        expect(url.toString()).toBe(options.resource)
        expect(options.resource).toMatch(/example\.com\/(users|comments)/)
        expect(options.method).toBe('get')
        expect(options.headers.get('x-static')).toEqual('static value')
        expect(options.headers.has('Authorization')).toEqual(false)

        await new Promise((resolve) => setTimeout(resolve, 32))
        options.headers.set('Authorization', `Bearer ${token}`)
      },
    })

    token = 'pre-token-1'
    setTimeout(() => {
      token = 'token-1'
    }, 16)

    await api.get('/comments')

    token = 'pre-token-2'
    setTimeout(() => {
      token = 'token-2'
    }, 16)

    await api.get('/users')

    expect(commentsEndpoint).toHaveBeenCalledTimes(1)
    expect(usersEndpoint).toHaveBeenCalledTimes(1)
  })
})

describe('Timeout', () => {
  test('should throw if timeout is passed', async () => {
    const endpoint = vi.fn(async () => {
      await delay(20)
      return new Response()
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const promise = YF.get('http://localhost/comments', { timeout: 10 })

    await expect(promise).rejects.toThrow(new YF.TimeoutError())
    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('should resolve if timeout is smaller than delay', async () => {
    const endpoint = vi.fn(async () => {
      await delay(10)
      return new Response()
    })

    server.use(http.get('http://localhost/comments', endpoint))

    await YF.get('http://localhost/comments', { timeout: 20 })
    expect(endpoint).toHaveBeenCalledTimes(1)
  })
})

describe('AbortController', () => {
  test('AbortController should cancel request', async () => {
    const endpoint = vi.fn(async () => {
      await delay(20)
      return new Response()
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10)

    try {
      await YF.get('http://localhost/comments', {
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error) {
        expect(error.name).toBe('AbortError')
      }
    }

    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('AbortController should cancel request with timeout', async () => {
    const endpoint = vi.fn(async () => {
      await delay(20)
      return new Response()
    })

    server.use(http.get('http://localhost/comments', endpoint))
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10)

    try {
      await YF.get('http://localhost/comments', {
        signal: controller.signal,
        timeout: 15,
      })
    } catch (error) {
      if (error instanceof Error) {
        expect(error.name).toBe('AbortError')
      }
    }

    expect(endpoint).toHaveBeenCalledTimes(1)
  })

  test('AbortController should cancel request before timeout', async () => {
    const endpoint = vi.fn(async () => {
      await delay(20)
      return new Response()
    })

    server.use(http.get('http://localhost/comments', endpoint))

    const controller = new AbortController()
    setTimeout(() => controller.abort(), 10)

    try {
      await YF.get('http://localhost/comments', {
        signal: controller.signal,
        timeout: 5,
      })
    } catch (error) {
      expect(error).toBeInstanceOf(YF.TimeoutError)
    }

    expect(endpoint).toHaveBeenCalledTimes(1)
  })
})

describe('Methods', () => {
  describe('GET', () => {
    test('should perform success get request', async () => {
      const endpoint = vi.fn(() => new Response('ok'))
      server.use(http.get('http://localhost/comments', endpoint))

      const result = await YF.get('http://localhost/comments').text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should throw `ResponseError` on failed get request', async () => {
      expect.assertions(5)

      const endpoint = vi.fn(() => new Response(null, { status: 400 }))
      server.use(http.get('http://localhost/comments', endpoint))

      try {
        await YF.get('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.message).toBe('Request failed with status code 400')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      expect(endpoint).toHaveBeenCalledTimes(1)
    })
  })

  describe('POST', () => {
    test('should perform success post `json` request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(request.headers.get('content-type')).toBe('application/json')
          expect(await request.json()).toEqual({ user: 'test' })

          return new Response('ok')
        }
      )

      server.use(http.post('http://localhost/comments', endpoint))

      const result = await YF.post('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should perform success post `formData` request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(request.headers.get('content-type')).toMatch(
            /^multipart\/form-data;/
          )

          expect(await request.text()).toMatch(
            /form-data; name="user"[\r\n]*test/
          )

          return new Response('ok')
        }
      )

      server.use(http.post('http://localhost/comments', endpoint))

      const body = new FormData()
      body.append('user', 'test')

      const result = await YF.post('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should perform success post `text` request', async () => {
      expect.assertions(3)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(await request.text()).toBe('data')
          return new Response('ok')
        }
      )

      server.use(http.post('http://localhost/comments', endpoint))

      const result = await YF.post('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should throw `ResponseError` on failed post request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn(() => new Response(null, { status: 400 }))
      server.use(http.post('http://localhost/comments', endpoint))

      try {
        await YF.post('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      expect(endpoint).toHaveBeenCalledTimes(1)
    })
  })

  describe('PUT', () => {
    test('should perform success put `json` request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(request.headers.get('content-type')).toBe('application/json')
          expect(await request.json()).toEqual({ user: 'test' })

          return new Response('ok')
        }
      )

      server.use(http.put('http://localhost/comments', endpoint))

      const result = await YF.put('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should perform success put `formData` request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(request.headers.get('content-type')).toMatch(
            /^multipart\/form-data;/
          )

          expect(await request.text()).toMatch(
            /form-data; name="user"[\r\n]*test/
          )

          return new Response('ok')
        }
      )

      server.use(http.put('http://localhost/comments', endpoint))

      const body = new FormData()
      body.append('user', 'test')

      const result = await YF.put('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should perform success put `text` request', async () => {
      expect.assertions(3)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(await request.text()).toBe('data')
          return new Response('ok')
        }
      )

      server.use(http.put('http://localhost/comments', endpoint))

      const result = await YF.put('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should throw `ResponseError` on failed put request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn(() => new Response(null, { status: 400 }))
      server.use(http.put('http://localhost/comments', endpoint))

      try {
        await YF.put('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      expect(endpoint).toHaveBeenCalledTimes(1)
    })
  })

  describe('PATCH', () => {
    test('should perform success patch `json` request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(request.headers.get('content-type')).toBe('application/json')
          expect(await request.json()).toEqual({ user: 'test' })

          return new Response('ok')
        }
      )

      server.use(http.patch('http://localhost/comments', endpoint))

      const result = await YF.patch('http://localhost/comments', {
        json: { user: 'test' },
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should perform success patch `formData` request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(request.headers.get('content-type')).toMatch(
            /^multipart\/form-data;/
          )

          expect(await request.text()).toMatch(
            /form-data; name="user"[\r\n]*test/
          )

          return new Response('ok')
        }
      )

      server.use(http.patch('http://localhost/comments', endpoint))

      const body = new FormData()
      body.append('user', 'test')

      const result = await YF.patch('http://localhost/comments', {
        body,
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should perform success patch `text` request', async () => {
      expect.assertions(3)

      const endpoint = vi.fn<Parameters<ResponseResolver>>(
        async ({ request }) => {
          expect(await request.text()).toBe('data')
          return new Response('ok')
        }
      )

      server.use(http.patch('http://localhost/comments', endpoint))

      const result = await YF.patch('http://localhost/comments', {
        body: 'data',
      }).text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should throw `ResponseError` on failed patch request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn(() => new Response(null, { status: 400 }))
      server.use(http.patch('http://localhost/comments', endpoint))

      try {
        await YF.patch('http://localhost/comments')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      expect(endpoint).toHaveBeenCalledTimes(1)
    })
  })

  describe('DELETE', () => {
    test('should perform success delete request', async () => {
      const endpoint = vi.fn(() => new Response('ok'))
      server.use(http.delete('http://localhost/comments/1', endpoint))

      const result = await YF.delete('http://localhost/comments/1').text()

      expect(result).toBe('ok')
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should throw `ResponseError` on failed delete request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn(() => new Response(null, { status: 400 }))
      server.use(http.delete('http://localhost/comments/1', endpoint))

      try {
        await YF.delete('http://localhost/comments/1')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      expect(endpoint).toHaveBeenCalledTimes(1)
    })
  })

  describe('HEAD', () => {
    test('should perform success head request', async () => {
      const endpoint = vi.fn(() => new Response())
      server.use(http.head('http://localhost/comments/1', endpoint))

      const response = await YF.head('http://localhost/comments/1')

      expect(response.status).toBe(200)
      expect(endpoint).toHaveBeenCalledTimes(1)
    })

    test('should throw `ResponseError` on failed head request', async () => {
      expect.assertions(4)

      const endpoint = vi.fn(() => new Response(null, { status: 400 }))
      server.use(http.head('http://localhost/comments/1', endpoint))

      try {
        await YF.head('http://localhost/comments/1')
      } catch (error) {
        if (error instanceof YF.ResponseError) {
          expect(error.name).toBe('ResponseError')
          expect(error.response).toBeInstanceOf(Response)
          expect(error.response.status).toBe(400)
        }
      }

      expect(endpoint).toHaveBeenCalledTimes(1)
    })
  })
})

test('receive voided response', async () => {
  const endpoint = vi.fn(() => Response.json([1, 2, 3, 4]))

  server.use(http.get('http://localhost/comments', endpoint))
  const result = await YF.get('http://localhost/comments').void()

  expect(result).toEqual(undefined)
  expect(endpoint).toHaveBeenCalledTimes(1)
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
  const endpoint = vi.fn(() => new Response())
  server.use(http.get('http://example.com/foo', endpoint))

  await YF.get('/foo', { base: 'http://example.com' })

  expect(endpoint).toHaveBeenCalledTimes(1)
})

test('throw if no base', async () => {
  await expect(YF.get('/foo')).rejects.toThrowError(
    new TypeError('Invalid URL')
  )
})

test('extend headers', async () => {
  const endpoint1 = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
    request.headers.get('x-from') === 'website'
      ? Response.json([])
      : Response.error()
  )

  const endpoint2 = vi.fn<Parameters<ResponseResolver>>(({ request }) =>
    request.headers.get('x-from') === 'website' &&
    request.headers.get('authorization') === 'Bearer token'
      ? new Response()
      : Response.error()
  )

  server.use(
    http.get('http://localhost/posts', endpoint1),
    http.post('http://localhost/posts', endpoint2)
  )

  const instance = YF.create({
    headers: { 'x-from': 'website' },
  })

  const authorized = instance.extend({
    headers: { Authorization: 'Bearer token' },
  })

  const res1 = await instance.get('http://localhost/posts').json()
  expect(res1).toEqual([])

  const res2 = await authorized.post('http://localhost/posts').void()
  expect(res2).toEqual(undefined)

  expect(endpoint1).toHaveBeenCalledTimes(1)
  expect(endpoint2).toHaveBeenCalledTimes(1)
})

test('extend resource', async () => {
  expect.assertions(8)

  const listEndpoint = vi.fn(() => Response.json([]))
  const detailsEndpoint = vi.fn(() => Response.json({ title: 'Hello' }))

  const createEndpoint = vi.fn<Parameters<ResponseResolver>>(
    async ({ request }) => {
      expect(await request.json()).toEqual({ title: 'Hello' })
      return new Response('ok')
    }
  )

  server.use(
    http.get('http://localhost/posts', listEndpoint),
    http.get('http://localhost/posts/1', detailsEndpoint),
    http.post('http://localhost/posts', createEndpoint)
  )

  const instance = YF.create({ resource: 'http://localhost' })
  const res1 = await instance.get('/posts').json()
  expect(res1).toEqual([])

  const postsApi = instance.extend({ resource: '/posts' })
  const res2 = await postsApi.get().json()
  expect(res2).toEqual([])

  const res3 = await postsApi.post({ json: { title: 'Hello' } }).text()
  expect(res3).toBe('ok')

  const res4 = await postsApi.get('/1').json()
  expect(res4).toEqual({ title: 'Hello' })

  expect(listEndpoint).toHaveBeenCalledTimes(2)
  expect(createEndpoint).toHaveBeenCalledTimes(1)
  expect(detailsEndpoint).toHaveBeenCalledTimes(1)
})

test('auto retry', async () => {
  const state = {
    limit: 2,
    count: 0,
  }

  const endpoint = vi.fn(() => {
    if (state.count < state.limit) {
      state.count += 1
      return new Response(null, { status: 500 })
    }

    return new Response('OK')
  })

  server.use(http.get('http://localhost/comments', endpoint))

  const api = YF.create({
    resource: 'http://localhost',
  })

  const result = await api.get('/comments').text()

  expect(state.count).toBe(state.limit)
  expect(result).toBe('OK')
  expect(endpoint).toHaveBeenCalledTimes(3)
})

test('retry', async () => {
  const state = {
    limit: 3,
    count: 0,
  }

  const endpoint = vi.fn(() => {
    if (state.count < state.limit) {
      state.count += 1
      return new Response(null, { status: 500 })
    }

    return new Response('OK')
  })

  server.use(http.get('http://localhost/comments', endpoint))

  const api = YF.create({
    resource: 'http://localhost',
    retry: ({ attempt, status }) => attempt < state.limit && status === 500,
  })

  const timestamp = Date.now()
  const result = await api.get('/comments').text()

  expect(Date.now() - timestamp).toBeGreaterThan(2000)
  expect(state.count).toBe(state.limit)
  expect(result).toBe('OK')
  expect(endpoint).toHaveBeenCalledTimes(4)
})
