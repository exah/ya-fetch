type RequestMethods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'HEAD' | 'DELETE'
type ContentTypes =
  | 'json'
  | 'text'
  | 'formData'
  | 'arrayBuffer'
  | 'blob'
  | 'void'

export interface Headers extends Record<string, string> {}
export interface Payload {
  json?: unknown
  params?: Record<string, any>
}

export interface ResponseBody extends Promise<Response> {
  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}

export interface Options<P extends Payload> extends RequestInit {
  /** Resource URL */
  resource?: string
  /** Object that will be stringified with `JSON.stringify` */
  json?: P['json']
  /** Object that can be passed to `serialize` */
  params?: P['params']
  /** Throw `TimeoutError` if timeout is passed */
  timeout?: number
  /** String that will prepended to `resource` in `fetch` instance */
  prefixUrl?: string
  /** Request headers */
  headers?: Headers
  /**
   * `node-fetch` v3 option, default is 10mb
   * @url https://github.com/exah/ya-fetch#node-js-support
   */
  highWaterMark?: number
  /** Request headers, can be async */
  getHeaders?(resource: string, init: RequestInit): Headers | Promise<Headers>
  /** Custom params serializer, default to `URLSearchParams` */
  serialize?(params: P['params']): URLSearchParams | string
  /** Response handler, must handle status codes or throw `ResponseError` */
  onResponse?(
    response: Response,
    options: Options<P>
  ): Response | Promise<Response>
  /** Response handler with success status codes 200-299 */
  onSuccess?(
    response: Response,
    options: Options<P>
  ): Response | Promise<Response>
  /** Error handler. Throw passed `error` for unhandled cases, throw custom errors, or return the new `Response` */
  onFailure?(
    error: ResponseError | AbortError | TimeoutError | TypeError | Error,
    options: Options<P>
  ): Response | Promise<Response>
  /** Transform parsed JSON from response */
  onJSON?(input: unknown): unknown
}

export interface Instance<P extends Payload> {
  (resource: string, options?: Options<P>): ResponseBody

  create<P extends Payload>(options?: Options<P>): Instance<P>
  extend<T extends P>(options?: Options<T>): Instance<T>

  get<T extends P>(resource: string, options?: Options<T>): ResponseBody
  post<T extends P>(resource: string, options?: Options<T>): ResponseBody
  put<T extends P>(resource: string, options?: Options<T>): ResponseBody
  patch<T extends P>(resource: string, options?: Options<T>): ResponseBody
  head<T extends P>(resource: string, options?: Options<T>): ResponseBody
  delete<T extends P>(resource: string, options?: Options<T>): ResponseBody

  options: Options<P>
}

type ResponseError = Error & {
  name: 'ResponseError'
  response: Response
}

type TimeoutError = Error & {
  name: 'TimeoutError'
}

type AbortError = Error & {
  name: 'AbortError'
}

const CONTENT_TYPES: Record<ContentTypes, string | undefined> = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
  void: '*/*',
}

const ERROR_NAMES = {
  Response: 'ResponseError',
  Timeout: 'TimeoutError',
  Abort: 'AbortError',
} as const

const DEFAULTS: Options<Payload> = {
  prefixUrl: '',
  credentials: 'same-origin',
  highWaterMark: 1024 * 1024 * 10, // 10mb
  serialize(params: Payload['params']) {
    return new URLSearchParams(params)
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
  onJSON(json) {
    return json
  },
}

const { keys, assign } = Object
const empty = {}
const merge = <A, B>(a?: A, b?: B): A & B => assign({}, a, b)

const mergeOptions = <A, B>(
  left: Options<A> = empty,
  right: Options<B> = empty
) =>
  merge(merge(left, right), {
    headers: merge(left.headers, right.headers),
    params: merge(left.params, right.params),
  })

function ResponseError(
  response: Response,
  message = response.statusText || String(response.status)
): ResponseError {
  return assign(new Error(message), {
    name: ERROR_NAMES.Response,
    response,
  })
}

function TimeoutError(): TimeoutError {
  return assign(new Error('Request timed out'), {
    name: ERROR_NAMES.Timeout,
  })
}

function isResponseError(error: any): error is ResponseError {
  return error.name === ERROR_NAMES.Response
}

function isAbortError(error: any): error is AbortError {
  return error.name === ERROR_NAMES.Abort
}

function isTimeoutError(error: any): error is TimeoutError {
  return error.name === ERROR_NAMES.Timeout
}

function request<P extends Payload>(baseOptions: Options<P>): ResponseBody {
  const opts = mergeOptions(DEFAULTS, baseOptions)
  const query = keys(opts.params).length
    ? '?' + opts.serialize(opts.params)
    : ''

  const resource = opts.prefixUrl + opts.resource + query

  if (opts.json != null) {
    opts.body = JSON.stringify(opts.json)
    opts.headers['content-type'] = CONTENT_TYPES.json
  }

  const promise = new Promise<Response>((resolve, reject) => {
    let timerID: ReturnType<typeof setTimeout>

    if (opts.timeout > 0) {
      if (typeof AbortController === 'function') {
        const controller = new AbortController()

        timerID = setTimeout(() => {
          reject(TimeoutError())
          controller.abort()
        }, opts.timeout)

        if (opts.signal != null) {
          opts.signal.addEventListener('abort', () => {
            clearTimeout(timerID)
            controller.abort()
          })
        }

        opts.signal = controller.signal
      } else {
        timerID = setTimeout(() => reject(TimeoutError()), opts.timeout)
      }
    }

    // Running fetch in next tick allow us to set headers after creating promise
    setTimeout(() =>
      Promise.resolve()
        .then(() =>
          opts.getHeaders ? opts.getHeaders(resource, opts) : undefined
        )
        .then((headers) => {
          assign(opts.headers, headers)
          return fetch(resource, opts)
        })
        .then((response) => opts.onResponse(response, opts))
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    )
  })
    .then((response) => opts.onSuccess(response, opts))
    .catch((error) => opts.onFailure(error, opts))

  return (keys(CONTENT_TYPES) as ContentTypes[]).reduce((acc, key) => {
    acc[key] = () => {
      opts.headers.accept = CONTENT_TYPES[key]
      return promise
        .then((response) => response.clone())
        .then((response) => (key === 'void' ? undefined : response[key]()))
        .then((parsed) => (key === 'json' ? opts.onJSON(parsed) : parsed))
    }
    return acc
  }, promise as ResponseBody)
}

function create<P extends Payload>(baseOptions?: Options<P>): Instance<P> {
  const extend = <T extends P>(options: Options<T>) =>
    create<T>(mergeOptions(instance.options, options))

  const createMethod =
    (method: RequestMethods) =>
    <T extends P>(
      resource: string,
      options?: Omit<Options<T>, 'method' | 'resource'>
    ) =>
      request<P & T>(
        mergeOptions(instance.options, merge({ resource, method }, options))
      )

  const instance = {
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

  return assign(instance.get, instance)
}

export {
  create,
  request,
  isAbortError,
  isAbortError as isAborted, // COMPAT
  isTimeoutError,
  isTimeoutError as isTimeout, // COMPAT
  isResponseError,
  ResponseError,
  TimeoutError,
}

export default create()
