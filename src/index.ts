type RequestMethods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'HEAD' | 'DELETE'
type ContentTypes =
  | 'json'
  | 'text'
  | 'formData'
  | 'arrayBuffer'
  | 'blob'
  | 'void'

interface Headers extends Record<string, string> {}

interface Payload {
  json?: unknown
  params?: Record<string, string | number | string[] | number[]>
}

interface Methods extends Promise<Response> {
  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}

interface Options<P extends Payload> extends RequestInit {
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
  getOptions?(
    resource: string,
    init: RequestInit
  ): Promise<Options<P>> | Options<P> | Promise<void> | void
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
    error: ResponseError | TimeoutError | TypeError | Error,
    options: Options<P>
  ): Response | Promise<Response>
  /** Transform parsed JSON from response */
  onJSON?(input: unknown): unknown
}

interface Instance<P extends Payload> {
  (resource: string, options?: Options<P>): Methods

  extend<T extends P>(options?: Options<T>): Instance<T>

  get<T extends P>(resource: string, options?: Options<T>): Methods
  post<T extends P>(resource: string, options?: Options<T>): Methods
  put<T extends P>(resource: string, options?: Options<T>): Methods
  patch<T extends P>(resource: string, options?: Options<T>): Methods
  head<T extends P>(resource: string, options?: Options<T>): Methods
  delete<T extends P>(resource: string, options?: Options<T>): Methods

  options: Options<P>
}

const CONTENT_TYPES: Record<ContentTypes, string | undefined> = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
  void: undefined,
}

const DEFAULTS: Options<Payload> = {
  prefixUrl: '',
  credentials: 'same-origin',
  highWaterMark: 1024 * 1024 * 10, // 10mb
  serialize,
  getOptions: () => {},
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

class ResponseError extends Error {
  name = 'ResponseError'
  response: Response

  constructor(
    response: Response,
    message = response.statusText || String(response.status)
  ) {
    super(message)
    this.response = response
  }
}

class TimeoutError extends Error {
  name = 'TimeoutError'
  response: Response

  constructor() {
    super('Request timed out')
  }
}

function serialize(input: Payload['params']): URLSearchParams {
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

function request<P extends Payload>(baseOptions: Options<P>): Methods {
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
        reject(new TimeoutError())
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
  }, promise as Methods)
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
  Headers,
  Payload,
  Methods,
  Options,
  Instance,
  ResponseError,
  TimeoutError,
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
