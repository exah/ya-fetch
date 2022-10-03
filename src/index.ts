type RequestMethods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'HEAD' | 'DELETE'
type ContentTypes =
  | 'json'
  | 'text'
  | 'formData'
  | 'arrayBuffer'
  | 'blob'
  | 'void'

interface UnknownHeaders extends Record<string, string> {}
interface UnknownPayload {
  json?: unknown
  params?: Record<string, string | number | string[] | number[]>
}

interface ResponseBody extends Promise<Response> {
  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}

interface Options<Payload extends UnknownPayload> extends RequestInit {
  /** Resource URL */
  resource?: string
  /** Object that will be stringified with `JSON.stringify` */
  json?: Payload['json']
  /** Object that can be passed to `serialize` */
  params?: Payload['params']
  /** Throw `TimeoutError` if timeout is passed */
  timeout?: number
  /** String that will prepended to `resource` in `fetch` instance */
  prefixUrl?: string
  /** Request headers */
  headers?: UnknownHeaders
  /**
   * `node-fetch` v3 option, default is 10mb
   * @url https://github.com/exah/ya-fetch#node-js-support
   */
  highWaterMark?: number
  /** Request headers, can be async */
  getOptions?(
    resource: string,
    init: RequestInit
  ): Promise<Options<Payload>> | Options<Payload> | Promise<void> | void
  /** Custom params serializer, default to `URLSearchParams` */
  serialize?(params: Payload['params']): URLSearchParams | string
  /** Response handler, must handle status codes or throw `ResponseError` */
  onResponse?(
    response: Response,
    options: Options<Payload>
  ): Response | Promise<Response>
  /** Response handler with success status codes 200-299 */
  onSuccess?(
    response: Response,
    options: Options<Payload>
  ): Response | Promise<Response>
  /** Error handler. Throw passed `error` for unhandled cases, throw custom errors, or return the new `Response` */
  onFailure?(
    error: ResponseError | AbortError | TimeoutError | TypeError | Error,
    options: Options<Payload>
  ): Response | Promise<Response>
  /** Transform parsed JSON from response */
  onJSON?(input: unknown): unknown
}

interface Instance<Payload extends UnknownPayload> {
  (resource: string, options?: Options<Payload>): ResponseBody
  extend<P extends Payload>(options?: Options<P>): Instance<P>

  get<P extends Payload>(resource: string, options?: Options<P>): ResponseBody
  post<P extends Payload>(resource: string, options?: Options<P>): ResponseBody
  put<P extends Payload>(resource: string, options?: Options<P>): ResponseBody
  patch<P extends Payload>(resource: string, options?: Options<P>): ResponseBody
  head<P extends Payload>(resource: string, options?: Options<P>): ResponseBody
  delete<P extends Payload>(
    resource: string,
    options?: Options<P>
  ): ResponseBody

  options: Options<Payload>
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
  void: undefined,
}

const ERROR_NAMES = {
  Response: 'ResponseError',
  Timeout: 'TimeoutError',
  Abort: 'AbortError',
} as const

const DEFAULTS: Options<UnknownPayload> = {
  prefixUrl: '',
  credentials: 'same-origin',
  highWaterMark: 1024 * 1024 * 10, // 10mb
  serialize,
  getOptions: () => {},
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

const empty = {}
const merge = <A, B>(a?: A, b?: B): A & B => Object.assign({}, a, b)

const mergeOptions = <A, B>(
  left: Options<A> = empty,
  right: Options<B> = empty
) =>
  merge(merge(left, right), {
    headers: merge(left.headers, right.headers),
    params: merge(left.params, right.params),
  })

const ResponseError = (
  response: Response,
  message = response.statusText || String(response.status)
): ResponseError =>
  Object.assign(new Error(message), {
    name: ERROR_NAMES.Response,
    response,
  })

const TimeoutError = (): TimeoutError =>
  Object.assign(new Error('Request timed out'), {
    name: ERROR_NAMES.Timeout,
  })

const isResponseError = (error: Error): error is ResponseError =>
  error.name === ERROR_NAMES.Response

const isAbortError = (error: Error): error is AbortError =>
  error.name === ERROR_NAMES.Abort

const isTimeoutError = (error: Error): error is TimeoutError =>
  error.name === ERROR_NAMES.Timeout

function serialize(input: UnknownPayload['params']): URLSearchParams {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)))
    } else {
      params.set(key, String(value))
    }
  }

  return params
}

function request<Payload extends UnknownPayload>(
  baseOptions: Options<Payload>
): ResponseBody {
  const opts = mergeOptions(DEFAULTS, baseOptions)
  const query = Object.keys(opts.params).length
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
    }

    // Running fetch in next tick allow us to set headers after creating promise
    setTimeout(() =>
      Promise.resolve()
        .then(() => opts.getOptions(resource, opts))
        .then((options) =>
          fetch(
            resource,
            Object.assign(opts, options && mergeOptions(opts, options))
          )
        )
        .then((response) => opts.onResponse(response, opts))
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    )
  })
    .then((response) => opts.onSuccess(response, opts))
    .catch((error) => opts.onFailure(error, opts))

  return (Object.keys(CONTENT_TYPES) as ContentTypes[]).reduce((acc, key) => {
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

function create<Payload extends UnknownPayload>(
  baseOptions?: Options<Payload>
): Instance<Payload> {
  const extend = <T extends Payload>(options: Options<T>) =>
    create<T>(mergeOptions(instance.options, options))

  const createMethod =
    (method: RequestMethods) =>
    <T extends Payload>(
      resource: string,
      options?: Omit<Options<T>, 'method' | 'resource'>
    ) =>
      request<Payload & T>(
        mergeOptions(instance.options, merge({ resource, method }, options))
      )

  const instance = {
    extend,
    options: baseOptions,
    get: createMethod('GET'),
    post: createMethod('POST'),
    put: createMethod('PUT'),
    patch: createMethod('PATCH'),
    head: createMethod('HEAD'),
    delete: createMethod('DELETE'),
  }

  return Object.assign(instance.get, instance)
}

const {
  extend,
  options,
  get,
  post,
  put,
  patch,
  head,
  delete: _delete,
} = create()

export {
  ResponseBody,
  Options,
  Instance,
  ResponseError,
  TimeoutError,
  isResponseError,
  isAbortError,
  isTimeoutError,
  serialize,
  request,
  create,
  extend,
  options,
  get,
  post,
  put,
  patch,
  head,
  _delete as delete,
}
