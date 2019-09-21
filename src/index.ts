type RequestMethods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'HEAD' | 'DELETE'
type ContentTypes = 'json' | 'text' | 'formData' | 'arrayBuffer' | 'blob'

interface Request extends Promise<Response> {
  json?<T>(): Promise<T>
  text?(): Promise<string>
  blob?(): Promise<Blob>
  arrayBuffer?(): Promise<ArrayBuffer>
  formData?(): Promise<FormData>
}

interface Options extends RequestInit {
  /** Object that will be stringified with `JSON.stringify` */
  json?: unknown
  /** Object that can be passed to `serialize` */
  params?: unknown
  /** Throw `TimeoutError`if timeout is passed */
  timeout?: number
  /** String that will prepended to `resource` in `fetch` instance */
  prefixUrl?: string
  /** Request headers */
  headers?: Record<string, string>
  /** Custom params serializer, default to `URLSearchParams` */
  serialize?(params: unknown): string
  /** Custom fetch instance */
  fetch?(resource: string, init: RequestInit): Promise<Response>
  /** Response handler, must throw `ResponseError` */
  onResponse?(response: Response): Response
  /** Response handler with sucess status codes 200-299 */
  onSuccess?(value: Response): Response
  /** Error handler, must throw an `Error` */
  onFailure?(error: Error): never
}

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

const mergeOptions = (left: Options = {}, right: Options = {}) => ({
  ...left,
  ...right,
  headers: { ...left.headers, ...right.headers },
})

function isAborted(error: Error) {
  return error.name === 'AbortError'
}

function isTimeout(error: Error) {
  return error.name === 'TimeoutError'
}

const DEFAULT_OPTIONS: Options = {
  prefixUrl: '',
  credentials: 'same-origin',
  fetch,
  serialize(params: URLSearchParams) {
    return new URLSearchParams(params).toString()
  },
  onResponse(response) {
    if (response.ok) {
      return response
    }

    throw new ResponseError(response)
  },
  onSuccess(response) {
    return response
  },
  onFailure(error) {
    throw error
  },
}

function request(baseResource: string, baseInit: Options): Request {
  const {
    json,
    params,
    timeout,
    prefixUrl = '',
    serialize,
    fetch: fetchInstance,
    onResponse,
    onSuccess,
    onFailure,
    ...options
  } = mergeOptions(DEFAULT_OPTIONS, baseInit)

  const query = params == null ? '' : '?' + serialize(params)
  const resource = prefixUrl + baseResource + query

  const headers = new Headers(options.headers)
  const init: RequestInit = { ...options, headers }

  if (json != null) {
    init.body = JSON.stringify(json)
    headers.set('content-type', CONTENT_TYPES.json)
  }

  if (options.body instanceof FormData) {
    headers.set('content-type', CONTENT_TYPES.formData)
  }

  const promise: Request = new Promise<Response>((resolve, reject) => {
    let timerID: any

    if (timeout > 0) {
      if (typeof AbortController === 'function') {
        const controller = new AbortController()

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
      } else {
        timerID = setTimeout(() => reject(new TimeoutError()), timeout)
      }
    }

    // Running fetch in next tick allow us to set headers after creating promise
    setTimeout(() =>
      fetchInstance(resource, init)
        .then(onResponse)
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    )
  }).then(onSuccess, onFailure)

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

function create(baseOptions?: Options) {
  const extend = (options: Options) =>
    create(mergeOptions(baseOptions, options))

  const createMethod = (method: RequestMethods) => (
    resource: string,
    options?: Options
  ) => request(resource, mergeOptions(baseOptions, { method, ...options }))

  const intance = {
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

  return Object.assign(intance.get, intance)
}

export { create, isAborted, isTimeout, ResponseError, TimeoutError }

export default create()
