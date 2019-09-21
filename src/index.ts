type RequestMethods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'HEAD' | 'DELETE'
type ContentTypes = 'json' | 'text' | 'formData' | 'arrayBuffer' | 'blob'

type RequestFn = (resource: string, options?: Options) => RequestBody

interface RequestBody extends Promise<Response> {
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
  /** Response handler, must handle status codes or throw `ResponseError` */
  onResponse?(response: Response): Response
  /** Response handler with sucess status codes 200-299 */
  onSuccess?(value: Response): Response
  /** Error handler, must throw an `Error` */
  onFailure?(error: Error): never
}

interface Instance extends RequestFn {
  create(options?: Options): Instance
  extend(options?: Options): Instance
  options: Options
  get: RequestFn
  post: RequestFn
  put: RequestFn
  patch: RequestFn
  head: RequestFn
  delete: RequestFn
}

const CONTENT_TYPES: Record<ContentTypes, string> = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
}

function ResponseError(response: Response) {
  return Object.assign(new Error(response.statusText), {
    name: 'ResponseError',
    response: response,
  })
}

function TimeoutError() {
  return Object.assign(new Error('Request timed out'), {
    name: 'TimeoutError',
  })
}

const merge = (a?: unknown, b?: unknown, c?: unknown, d?: unknown) =>
  Object.assign({}, a, b, c, d)

const mergeOptions = (left: Options = {}, right: Options = {}): Options =>
  merge(left, right, { headers: merge(left.headers, right.headers) })

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

    throw ResponseError(response)
  },
  onSuccess(response) {
    return response
  },
  onFailure(error) {
    throw error
  },
}

function request(baseResource: string, baseInit: Options): RequestBody {
  const options = mergeOptions(DEFAULT_OPTIONS, baseInit)

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
  } = options

  const query = params == null ? '' : '?' + serialize(params)
  const resource = prefixUrl + baseResource + query

  const headers = new Headers(options.headers)
  const init: RequestInit = merge(options, { headers })

  if (json != null) {
    init.body = JSON.stringify(json)
    headers.set('content-type', CONTENT_TYPES.json)
  }

  if (options.body instanceof FormData) {
    headers.set('content-type', CONTENT_TYPES.formData)
  }

  const promise: RequestBody = new Promise<Response>((resolve, reject) => {
    let timerID: any

    if (timeout > 0) {
      if (typeof AbortController === 'function') {
        const controller = new AbortController()

        timerID = setTimeout(() => {
          reject(TimeoutError())
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
        timerID = setTimeout(() => reject(TimeoutError()), timeout)
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

  return (Object.keys(CONTENT_TYPES) as ContentTypes[]).reduce<RequestBody>(
    (acc, key) => {
      acc[key] = () => {
        headers.set('accept', CONTENT_TYPES[key])
        return promise
          .then((response) => response.clone())
          .then((response) => response[key]())
      }
      return acc
    },
    promise
  )
}

function create(baseOptions?: Options): Instance {
  const extend = (options: Options) =>
    create(mergeOptions(baseOptions, options))

  const createMethod = (method: RequestMethods) => (
    resource: string,
    options?: Options
  ) => request(resource, mergeOptions(baseOptions, merge({ method }, options)))

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

export { create, request, isAborted, isTimeout, ResponseError, TimeoutError }

export default create()
