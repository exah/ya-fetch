interface SearchParams extends Record<string, any> {}

interface Payload {
  json?: unknown
  params?: SearchParams | URLSearchParams | string
}

interface Response<P extends Payload = Payload> extends globalThis.Response {
  options: RequestOptions<P>
}

interface BodyMethods {
  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}

interface ResponsePromise<P extends Payload = Payload>
  extends Promise<Response<P>>,
    BodyMethods {}

interface Serializer {
  (params: SearchParams): URLSearchParams | string
}

interface RequestMethod<P extends Payload> {
  <T extends P>(
    resource?: number | string | RequestMethodOptions<T>,
    options?: RequestMethodOptions<T>
  ): ResponsePromise<T>
}

interface RequiredOptions<P extends Payload> extends RequestInit {
  /**
   * Part of the request URL
   */
  resource?: string
  /**
   * Request headers
   */
  headers?: HeadersInit
  /**
   * Body for `application/json` type requests, stringified with `JSON.stringify`.
   */
  json?: P['json']
  /**
   * Search params to append to the request URL.
   * Provide an `object`, `string`, or `URLSearchParams` instance.
   */
  params?: P['params']
  /**
   * Custom search params serializer when `object` is used.
   * Defaults to internal implementation based on `URLSearchParams`
   * with better handling of array values.
   */
  serialize?: Serializer
  /**
   * If specified `TimeoutError` will be thrown and
   * the request will be cancelled after the specified duration.
   */
  timeout?: number
  /**
   * `node-fetch` v3 option, default is 10mb.\
   * @see {@link https://github.com/exah/ya-fetch#node-js-support}
   */
  highWaterMark?: number
  /**
   * Request handler.
   * Use the callback to modify options before the request
   */
  onRequest(url: URL, options: RequestOptions<P>): Promise<void> | void
  /**
   * Response handler, must handle status codes or throw `ResponseError`
   */
  onResponse(response: Response<P>): Promise<Response<P>> | Response<P>
  /**
   * Success response handler (usually codes 200-299).
   * @see onResponse
   */
  onSuccess?(response: Response<P>): Promise<Response<P>> | Response<P>
  /**
   * Error handler.
   * Throw custom error, or return a new `Promise` with `Response` using `request`.
   * @see onResponse
   */
  onFailure?(
    error: ResponseError<P> | TimeoutError | Error
  ): Promise<Response<P>> | Response<P>
  /**
   * Transform parsed JSON from response.
   */
  onJSON(input: unknown): Promise<unknown> | unknown
}

interface RequestMethodOptions<P extends Payload>
  extends Omit<Options<P>, 'resource' | 'method'> {}

interface RequestOptions<P extends Payload>
  extends Omit<RequiredOptions<P>, 'headers' | 'params'> {
  resource: string
  headers: Headers
  params: URLSearchParams
}

interface Options<P extends Payload = Payload>
  extends Partial<RequiredOptions<P>> {}

interface Instance<P extends Payload = Payload> {
  get: RequestMethod<P>
  post: RequestMethod<P>
  patch: RequestMethod<P>
  put: RequestMethod<P>
  delete: RequestMethod<P>
  head: RequestMethod<P>
  extend<T extends P>(options?: Options<T>): Instance<T>
}

const CONTENT_TYPES = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
  void: '*/*',
} as const

const DEFAULTS: RequiredOptions<Payload> = {
  highWaterMark: 1024 * 1024 * 10, // 10mb
  onRequest: () => {},
  onResponse(result) {
    if (result.ok) {
      return result
    }

    throw new ResponseError(result)
  },
  onJSON: (json) => json,
}

function defaultSerialize(input: SearchParams): URLSearchParams {
  const params = new URLSearchParams()

  for (const key of Object.keys(input)) {
    if (Array.isArray(input[key])) {
      // @ts-expect-error checked the variable inside if statement
      input[key].forEach((item) => params.append(key, item))
    } else {
      params.append(key, input[key])
    }
  }

  return params
}

function mergeMaps<Init, Request extends URLSearchParams | Headers>(
  M: new (init?: Init) => Request,
  left?: Init,
  right?: Init
): Request {
  const result = new M(left)

  new M(right).forEach((value, key) => result.append(key, value))

  return result
}

const normalizeParams = (
  serialize: Serializer = defaultSerialize,
  params: SearchParams | URLSearchParams | string = ''
) =>
  typeof params === 'string' || params instanceof URLSearchParams
    ? params
    : serialize(params)

const mergeOptions = <A extends Options<Payload>, B extends Options<Payload>>(
  left: A,
  right: Partial<B>,
  serialize = right.serialize || left.serialize
) =>
  Object.assign({}, left, right, {
    resource: (left.resource || '') + (right.resource || ''),
    headers: mergeMaps(Headers, left.headers, right.headers),
    params: mergeMaps(
      URLSearchParams,
      normalizeParams(serialize, left.params),
      normalizeParams(serialize, right.params)
    ),
  })

class ResponseError<P extends Payload = Payload> extends Error {
  name = 'ResponseError'
  response: Response<P>

  constructor(response: Response<P>, message = response.statusText) {
    super(message)
    this.response = response
  }
}

class TimeoutError extends Error {
  name = 'TimeoutError'

  constructor() {
    super('Request timed out')
  }
}

function request<P extends Payload>(
  baseOptions: Options<P>
): ResponsePromise<P> {
  const options: RequestOptions<P> = mergeOptions(DEFAULTS, baseOptions)
  const promise = new Promise<Response<P>>((resolve, reject) => {
    const url = new URL(
      options.resource,
      typeof location === 'undefined' ? undefined : location.origin
    )

    url.search += options.params

    if (options.json != null) {
      options.body = JSON.stringify(options.json)
      options.headers.set('content-type', CONTENT_TYPES.json)
    }

    let timerID: ReturnType<typeof setTimeout>
    if (options.timeout! > 0) {
      const controller = new AbortController()

      timerID = setTimeout(() => {
        reject(new TimeoutError())
        controller.abort()
      }, options.timeout)

      if (options.signal != null) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(timerID)
          controller.abort()
        })
      }

      options.signal = controller.signal
    }

    // Running fetch in next tick allow us to set headers after creating promise
    setTimeout(() =>
      Promise.resolve(options.onRequest(url, options))
        .then(() => fetch(url, options))
        .then((response) => Object.assign(response, { options }))
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    )
  })
    .then(options.onResponse)
    .then(options.onSuccess, options.onFailure) as ResponsePromise<P>

  for (const key of Object.keys(CONTENT_TYPES) as Array<keyof BodyMethods>) {
    promise[key] = () => {
      options.headers.set('accept', CONTENT_TYPES[key])
      return promise
        .then((result) => (key === 'void' ? undefined : result.clone()[key]()))
        .then((parsed) => (key === 'json' ? options.onJSON(parsed) : parsed))
    }
  }

  return promise
}

function create<P extends Payload>(baseOptions: Options<P> = {}): Instance<P> {
  const extend = <T extends P>(options: Options<T>) =>
    create<T>(mergeOptions(baseOptions, options))

  const createMethod =
    (method: string): RequestMethod<P> =>
    (resource, options) =>
      request(
        mergeOptions(
          baseOptions,
          Object.assign(
            { method },
            typeof resource === 'string' || typeof resource === 'number'
              ? { resource }
              : resource,
            options
          )
        )
      )

  return {
    get: createMethod('GET'),
    post: createMethod('POST'),
    patch: createMethod('PATCH'),
    put: createMethod('PUT'),
    delete: createMethod('DELETE'),
    head: createMethod('HEAD'),
    extend,
  }
}

const { get, post, put, patch, head, delete: _delete } = create()

export {
  ResponsePromise,
  Payload,
  Options,
  Instance,
  Response,
  ResponseError,
  TimeoutError,
  Serializer,
  defaultSerialize as serialize,
  request,
  create,
  get,
  post,
  put,
  patch,
  head,
  _delete as delete,
}
