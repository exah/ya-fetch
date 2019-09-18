import {
  ContentTypes,
  RequestMethods,
  RequestOptions,
  RequestPromise,
} from './types'

const CONTENT_TYPES: Record<ContentTypes, string> = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
}

class ResponseError extends Error {
  response: Response
  constructor(response: Response) {
    super(response.statusText)
    this.name = 'ResponseError'
    this.response = response
  }
}

class TimeoutError extends Error {
  constructor() {
    super('Request timed out')
    this.name = 'TimeoutError'
  }
}

const mergeOptions = (
  left: RequestOptions = {},
  right: RequestOptions = {}
) => ({
  ...left,
  ...right,
  headers: { ...left.headers, ...right.headers },
})

function isAborted(error: Error) {
  return error.name === 'AbortError'
}

function isTimeout(error: Error) {
  return error instanceof TimeoutError
}

const DEFAULT_OPTIONS: RequestOptions = {
  prefixUrl: '',
  credentials: 'same-origin',
  serialize(params) {
    return new window.URLSearchParams(params).toString()
  },
  onResponse(response) {
    if (response.ok) {
      return response
    }

    throw new ResponseError(response)
  },
}

function request(baseResource: string, baseInit: RequestOptions) {
  const {
    json,
    params,
    timeout,
    prefixUrl = '',
    onResponse,
    serialize,
    ...options
  } = mergeOptions(DEFAULT_OPTIONS, baseInit)

  const query = params == null ? '' : '?' + serialize(params)
  const resource = prefixUrl + baseResource + query

  const headers = new window.Headers({
    ...options.headers,
  })

  const init: RequestInit = {
    ...options,
    headers,
  }

  if (json != null) {
    init.body = JSON.stringify(json)
    headers.set('content-type', CONTENT_TYPES.json)
  }

  if (options.body instanceof window.FormData) {
    headers.set('content-type', CONTENT_TYPES.formData)
  }

  const promise: RequestPromise = new Promise((resolve, reject) => {
    let timerID: number

    if (timeout > 0) {
      const controller = new window.AbortController()

      timerID = setTimeout(() => {
        reject(new TimeoutError())
        controller.abort()
      }, timeout)

      if (options.signal != null) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(timerID)
          controller.abort()
        })
      }

      init.signal = controller.signal
    }

    // running fetch in next tick this allows us
    // to set headers after creating promise
    setTimeout(() =>
      window
        .fetch(resource, init)
        .then(onResponse)
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    )
  })

  for (const [key, type] of Object.entries(CONTENT_TYPES) as [
    ContentTypes,
    string
  ][]) {
    promise[key] = () => {
      headers.set('accept', type)
      return promise
        .then((response) => response.clone())
        .then((response) => response[key]())
    }
  }

  return promise
}

function create(baseOptions?: RequestOptions) {
  const extend = (options: RequestOptions) =>
    create(mergeOptions(baseOptions, options))

  const createMethod = (method: RequestMethods) => (
    resource: string,
    options?: RequestOptions
  ) => request(resource, mergeOptions(baseOptions, { method, ...options }))

  const methods = {
    create,
    extend,
    options: baseOptions,
    get: createMethod('GET'),
    post: createMethod('POST'),
    put: createMethod('PUT'),
    patch: createMethod('PATCH'),
    head: createMethod('HEAD'),
    delete: createMethod('DELETE'),
  }

  return Object.assign(methods.get, methods)
}

export { create, isAborted, isTimeout, ResponseError, TimeoutError }

export default create()
