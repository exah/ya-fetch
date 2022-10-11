type RequestMethods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'HEAD' | 'DELETE'

interface HeadersRecord extends Record<string, string> {}
interface ParamsRecord
  extends Record<string, string | number | Array<string | number>> {}

interface Input {
  json?: unknown
  params?: ParamsRecord
}

interface Output<P extends Input = Input> extends Response {
  options: StrictOptions<P>
}

interface ContentMethods {
  json<T>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}

interface PromiseMethods<I extends Input>
  extends Promise<Output<I>>,
    ContentMethods {}

interface StrictOptions<P extends Input> extends RequestInit {
  url: string
  /** Resource URL or path if `prefixUrl` option is used */
  resource: string
  /** Object that will be stringified with `JSON.stringify` */
  json?: P['json']
  /** Object that can be passed to `serialize` */
  params?: Exclude<P['params'], undefined>
  /** Throw `TimeoutError` if timeout is passed */
  timeout: number
  /** String that will prepended to `url` in `fetch` instance */
  prefixUrl: string
  /** Request headers */
  headers?: HeadersRecord
  /**
   * `node-fetch` v3 option, default is 10mb
   * @url https://github.com/exah/ya-fetch#node-js-support
   */
  highWaterMark?: number
  /** Request options, can be async */
  getOptions(
    options: StrictOptions<P>
  ): Promise<Options<P> | undefined> | Options<P> | undefined
  /** Custom params serializer, default to `URLSearchParams` */
  serialize(
    params: Exclude<P['params'], undefined>
  ): URLSearchParams | string | undefined
  /** Response handler, must handle status codes or throw `ResponseError` */
  onResponse(response: Output<P>): Output<P> | Promise<Output<P>>
  /** Response handler with success status codes 200-299 */
  onSuccess?(response: Output<P>): Output<P> | Promise<Output<P>>
  /** Error handler. Throw passed `error` for unhandled cases, throw custom errors, or return the new `Response` */
  onFailure?(
    error: ResponseError<P> | TimeoutError | TypeError | Error
  ): Output<P> | Promise<Output<P>>
  /** Transform parsed JSON from response */
  onJSON(input: unknown): unknown
}

interface Options<P extends Input> extends Partial<StrictOptions<P>> {}

interface Instance<P extends Input> {
  options: Options<P>
  extend<T extends P>(options?: Options<T>): Instance<T>

  get<T extends P>(url: string, options?: Options<T>): PromiseMethods<T>
  post<T extends P>(url: string, options?: Options<T>): PromiseMethods<T>
  put<T extends P>(url: string, options?: Options<T>): PromiseMethods<T>
  patch<T extends P>(url: string, options?: Options<T>): PromiseMethods<T>
  head<T extends P>(url: string, options?: Options<T>): PromiseMethods<T>
  delete<T extends P>(url: string, options?: Options<T>): PromiseMethods<T>
}

const CONTENT_TYPES = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
  void: '*/*',
} as const

const DEFAULTS: StrictOptions<Input> = {
  url: '',
  prefixUrl: '',
  resource: '',
  credentials: 'same-origin',
  timeout: 0,
  highWaterMark: 1024 * 1024 * 10, // 10mb
  serialize,
  onResponse(result) {
    if (result.ok) {
      return result
    }

    throw new ResponseError(result)
  },
  onJSON: (json) => json,
  getOptions: () => undefined,
}

const merge = <A extends Options<Input>, B extends Options<Input>>(
  left: A,
  right: Partial<B> = {}
) =>
  Object.assign({}, left, right, {
    headers: Object.assign({}, left.headers, right.headers),
    params: Object.assign({}, left.params, right.params),
  })

class ResponseError<P extends Input> extends Error {
  name = 'ResponseError'
  response: Output<P>

  constructor(
    response: Output<P>,
    message = response.statusText || response.status
  ) {
    super(message as string)
    this.response = response
  }
}

class TimeoutError extends Error {
  name = 'TimeoutError'

  constructor() {
    super('Request timed out')
  }
}

function serialize(input: ParamsRecord): URLSearchParams {
  const params = new URLSearchParams()

  for (const key of Object.keys(input)) {
    const value = input[key]
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item as string))
    } else {
      params.set(key, value as string)
    }
  }

  return params
}

function request<P extends Input>(baseOptions?: Options<P>): PromiseMethods<P> {
  const opts = merge(DEFAULTS as StrictOptions<P>, baseOptions)
  const query = Object.keys(opts.params).length
    ? '?' + opts.serialize(opts.params)
    : ''

  opts.url = opts.prefixUrl + opts.resource + query

  if (opts.json != null) {
    opts.body = JSON.stringify(opts.json)
    opts.headers['content-type'] = CONTENT_TYPES.json
  }

  const promise = new Promise<Output<P>>((resolve, reject) => {
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
      Promise.resolve(opts.getOptions(opts))
        .then((options) => merge(opts, options))
        .then((options) => Promise.all([fetch(opts.url, options), options]))
        .then(([response, options]) => Object.assign(response, { options }))
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    )
  })
    .then(opts.onResponse)
    .then(opts.onSuccess, opts.onFailure)

  return (Object.keys(CONTENT_TYPES) as Array<keyof ContentMethods>).reduce(
    (acc, key) => {
      acc[key] = () => {
        opts.headers.accept = CONTENT_TYPES[key]
        return promise
          .then((response) => response.clone())
          .then((response) => (key === 'void' ? undefined : response[key]()))
          .then((parsed) => (key === 'json' ? opts.onJSON(parsed) : parsed))
      }
      return acc
    },
    promise as PromiseMethods<P>
  )
}

function create<P extends Input>(baseOptions: Options<P> = {}): Instance<P> {
  const extend = <T extends P>(nextOptions: Options<T>) =>
    create<P & T>(merge(baseOptions, nextOptions))

  const createMethod =
    (method: RequestMethods) =>
    <T extends P>(
      resource: string,
      nextOptions?: Omit<Options<T>, 'method' | 'resource'>
    ) =>
      request<P & T>(
        merge(baseOptions, merge({ resource, method }, nextOptions))
      )

  return {
    options: baseOptions,
    extend,
    get: createMethod('GET'),
    post: createMethod('POST'),
    put: createMethod('PUT'),
    patch: createMethod('PATCH'),
    head: createMethod('HEAD'),
    delete: createMethod('DELETE'),
  }
}

const { extend, get, post, put, patch, head, delete: _delete } = create()

export {
  HeadersRecord,
  Input,
  PromiseMethods,
  Options,
  Instance,
  ParamsRecord,
  Output,
  ResponseError,
  TimeoutError,
  serialize,
  request,
  create,
  extend,
  get,
  post,
  put,
  patch,
  head,
  _delete as delete,
}
