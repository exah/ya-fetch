interface SearchParams extends Record<string, any> {}

interface Payload {
  json?: unknown
  params?: SearchParams | URLSearchParams | string
}

interface Response<P extends Payload = Payload> extends globalThis.Response {
  options: RequestOptions<P>
  attempt: number
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

interface Serialize {
  (params: SearchParams): URLSearchParams | string
}

interface RequestMethod<P extends Payload> {
  <T extends P>(
    resource?: string | RequestMethodOptions<T>,
    options?: RequestMethodOptions<T>
  ): ResponsePromise<T>
}

interface RequiredOptions<P extends Payload> extends RequestInit {
  /**
   * Base of the request URL, default to `location.origin` if available.
   * Provide a valid url if you want to use relative `resource` path
   * when module loaded in `file://`, `about:blank` or Node.js environment.
   */
  base?: string
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
   * Search params to append to a request URL.
   */
  params?: P['params']
  /**
   * Custom search params serializer when `object` passed to `params`.
   * Defaults to internal implementation based on `URLSearchParams`
   * with better handling of array values.
   */
  serialize?: Serialize
  /**
   * If specified `TimeoutError` will be thrown and the request will be
   * cancelled after a specified duration.
   */
  timeout?: number
  /**
   * `node-fetch` v3 option, default is 10mb.\
   * @see {@link https://github.com/exah/ya-fetch#node-js-support}
   */
  highWaterMark?: number
  /**
   * Use the callback to modify options before a request
   */
  onRequest(url: URL, options: RequestOptions<P>): Promise<void> | void
  /**
   * Response handler, must handle status codes or throw `ResponseError`
   */
  onResponse(response: Response<P>): Promise<Response<P>> | Response<P>
  /**
   * Success response handler (usually codes 200-299).
   */
  onSuccess?(response: Response<P>): Promise<Response<P>> | Response<P>
  /**
   * Instance error handler. Use it to throw custom errors
   * or to send information to error tracking service.
   */
  onFailure?(
    error: ResponseError<P> | TimeoutError | Error
  ): Promise<Response<P>> | Response<P>
  /**
   * Condition for retrying failed requests
   */
  retry(response: Response<P>): boolean | void
  /**
   * Customize retry delay
   */
  delay(response: Response<P>): number
  /**
   * Transform parsed JSON from response.
   */
  onJSON(input: unknown): Promise<unknown> | unknown
}

interface RequestMethodOptions<P extends Payload>
  extends Omit<Options<P>, 'resource' | 'method'> {}

interface RequestOptions<P extends Payload> extends RequiredOptions<P> {
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
  base:
    typeof location !== 'undefined' && location.origin !== 'null'
      ? location.origin
      : undefined,
  highWaterMark: 1024 * 1024 * 10, // 10mb
  onRequest() {},
  onResponse(response) {
    if (response.ok) {
      return response
    }

    throw new ResponseError(response)
  },
  retry: (response) =>
    response.attempt < 2 &&
    [408, 413, 429, 500, 502, 503, 504].includes(response.status),
  delay: (response) => 0.3 * 2 ** response.attempt * 1000,
  onJSON: (json) => json,
}

const serialize = (input: SearchParams): URLSearchParams => {
  const params = new URLSearchParams()

  Object.entries(input).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item))
    } else if (value != null) {
      params.append(key, input[key])
    }
  })

  return params
}

const mergeMaps = <Init, Request extends URLSearchParams | Headers>(
  M: new (init?: Init) => Request,
  left?: Init,
  right?: Init
): Request => {
  const result = new M(left)

  new M(right).forEach((value, key) => result.append(key, value))

  return result
}

const normalizeParams = (
  transform: Serialize = serialize,
  params: SearchParams | URLSearchParams | string = ''
) =>
  typeof params === 'string' || params instanceof URLSearchParams
    ? params
    : transform(params)

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

interface ResponseError<P extends Payload = Payload> extends Error {
  response: Response<P>
}

class ResponseError<P extends Payload = Payload> extends Error {
  name = 'ResponseError'

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

const request = <P extends Payload>(
  baseOptions: Options<P>,
  attempt: number = 0
): ResponsePromise<P> => {
  let timerID: ReturnType<typeof setTimeout>

  const options: RequestOptions<P> = mergeOptions(DEFAULTS, baseOptions)
  const promise = new Promise<Response<P>>((resolve, reject) => {
    const url = new URL(options.resource, options.base)
    url.search += options.params

    if (options.json != null) {
      options.body = JSON.stringify(options.json)
      options.headers.set('content-type', CONTENT_TYPES.json)
    }

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

    Promise.resolve(options.onRequest(url, options))
      .then(() => fetch(url, options))
      .then((response) => Object.assign(response, { options, attempt }))
      .then(resolve, reject)
      .then(() => clearTimeout(timerID))
  })
    .then((response) =>
      options.retry(response)
        ? new Promise<Response<P>>((resolve) => {
            setTimeout(
              () => resolve(request(options, attempt + 1)),
              options.delay(response)
            )
          })
        : response
    )
    .then(options.onResponse)
    .then(options.onSuccess, options.onFailure) as ResponsePromise<P>

  Object.entries(CONTENT_TYPES).forEach(([key, value]) => {
    promise[key] = () => {
      options.headers.set('accept', value)
      return promise
        .then((result) => (key === 'void' ? undefined : result.clone()[key]()))
        .then((parsed) => (key === 'json' ? options.onJSON(parsed) : parsed))
    }
  })

  return promise
}

const create = <P extends Payload>(
  baseOptions: Options<P> = {}
): Instance<P> => {
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
            typeof resource === 'string' ? { resource } : resource,
            options
          )
        )
      )

  return {
    get: createMethod('get'),
    post: createMethod('post'),
    patch: createMethod('patch'),
    put: createMethod('put'),
    delete: createMethod('delete'),
    head: createMethod('head'),
    extend,
  }
}

const { get, post, put, patch, head, delete: _delete } = create()

export {
  type ResponsePromise,
  type Payload,
  type Options,
  type Instance,
  type Response,
  type Serialize,
  ResponseError,
  TimeoutError,
  serialize,
  request,
  create,
  get,
  post,
  put,
  patch,
  head,
  _delete as delete,
}
