/// <reference types="../env.d.ts" />

interface SearchParams extends Record<string, any> {}

interface OptionsPayload {
  json?: unknown
  params?: SearchParams | URLSearchParams | string
}

interface Response<
  Payload extends OptionsPayload = OptionsPayload,
  Data = unknown,
  Input = unknown,
> extends globalThis.Response {
  options: RequestOptions<Payload, Data, Input>
}

interface BodyMethods<Data> {
  json<T = Data>(): Promise<T>
  text(): Promise<string>
  blob(): Promise<Blob>
  arrayBuffer(): Promise<ArrayBuffer>
  formData(): Promise<FormData>
  void(): Promise<void>
}

interface ResponsePromise<
  Payload extends OptionsPayload = OptionsPayload,
  Data = unknown,
  Input = unknown,
> extends Promise<Response<Payload, Data, Input>>,
    BodyMethods<Data> {}

interface PartialResponsePromise<
  Payload extends OptionsPayload = OptionsPayload,
  Data = unknown,
  Input = unknown,
> extends Promise<Response<Payload, Data, Input>>,
    Partial<BodyMethods<Data>> {}

interface Serialize {
  (params: SearchParams): URLSearchParams | string
}

interface RequestMethod<Payload extends OptionsPayload, Data, Input> {
  <T extends OptionsPayload = Payload, D = Data, I = Input>(
    resource?: string | RequestMethodOptions<T, D, I>,
    options?: RequestMethodOptions<T, D, I>
  ): ResponsePromise<T, D, I>
}

interface RequiredOptions<
  Payload extends OptionsPayload,
  Data = unknown,
  Input = unknown,
> extends RequestInit {
  /**
   * Base of the request URL, default to `location.origin` if available.
   * Provide a valid url if you want to use relative `resource` path
   * when module loaded in `file://`, `about:blank` or Node.js environment.
   */
  base?: URL | string
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
  json?: Payload['json']
  /**
   * Search params to append to a request URL.
   */
  params?: Payload['params']
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
  onRequest(
    url: URL,
    options: RequestOptions<Payload, Data, Input>
  ): Promise<void> | void
  /**
   * Response handler, must handle status codes or throw `ResponseError`
   */
  onResponse(
    response: Response<Payload>
  ): Promise<Response<Payload>> | Response<Payload>
  /**
   * Success response handler (usually codes 200-299).
   */
  onSuccess?(
    response: Response<Payload>
  ): Promise<Response<Payload>> | Response<Payload>
  /**
   * Instance error handler. Use it to throw custom errors
   * or to send information to error tracking service.
   */
  onFailure?(error: unknown): Promise<Response<Payload>> | Response<Payload>
  /**
   * Transform parsed JSON from response.
   */
  onJSON(input: Input): Promise<Data> | Data
}

interface RequestMethodOptions<Payload extends OptionsPayload, Data, Input>
  extends Omit<Options<Payload, Data, Input>, 'resource' | 'method'> {}

interface RequestOptions<
  Payload extends OptionsPayload = OptionsPayload,
  Data = unknown,
  Input = unknown,
> extends RequiredOptions<Payload, Data, Input> {
  resource: string
  headers: Headers
  params: URLSearchParams
}

interface Options<
  Payload extends OptionsPayload = OptionsPayload,
  Data = unknown,
  Input = unknown,
> extends Partial<RequiredOptions<Payload, Data, Input>> {}

interface Instance<
  Payload extends OptionsPayload = OptionsPayload,
  Data = unknown,
  Input = unknown,
> {
  get: RequestMethod<Payload, Data, Input>
  post: RequestMethod<Payload, Data, Input>
  patch: RequestMethod<Payload, Data, Input>
  put: RequestMethod<Payload, Data, Input>
  delete: RequestMethod<Payload, Data, Input>
  head: RequestMethod<Payload, Data, Input>
  extend<T extends OptionsPayload = Payload, D = Data, I = Input>(
    options?: Options<T, D, I>
  ): Instance<T, D, I>
}

const CONTENT_TYPES = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
  void: '*/*',
} as const

const DEFAULTS: RequiredOptions<OptionsPayload> = {
  base:
    typeof location !== 'undefined' && location.origin !== 'null'
      ? location.origin
      : undefined,
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

function serialize(input: SearchParams): URLSearchParams {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item))
    } else if (value != null) {
      params.append(key, input[key])
    }
  }

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

const mergeOptions = <
  A extends Options<OptionsPayload>,
  B extends Options<OptionsPayload>,
>(
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

class ResponseError<P extends OptionsPayload = OptionsPayload> extends Error {
  name = 'ResponseError'
  status: number
  response: Response<P>

  constructor(
    response: Response<P>,
    message: string = `Request failed with status code ${response.status}`
  ) {
    super(message)
    this.status = response.status
    this.response = response
  }
}

class TimeoutError extends Error {
  name = 'TimeoutError'

  constructor() {
    super('Request timed out')
  }
}

function request<
  Payload extends OptionsPayload,
  Data = unknown,
  Input = unknown,
>(
  baseOptions: Options<Payload, Data, Input>
): ResponsePromise<Payload, Data, Input>
function request(baseOptions: Options): PartialResponsePromise {
  const options: RequestOptions = mergeOptions(DEFAULTS, baseOptions)

  let timerID: ReturnType<typeof setTimeout>
  const promise: PartialResponsePromise = new Promise<Response>(
    (resolve, reject) => {
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
        .then((response) => Object.assign(response, { options }))
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    }
  )
    .then(options.onResponse)
    .then(options.onSuccess, options.onFailure)

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

function create<Payload extends OptionsPayload, Data, Input>(
  baseOptions: Options<Payload, Data, Input> = {}
): Instance<Payload, Data, Input> {
  const extend = <T extends OptionsPayload = Payload, D = Data, I = Input>(
    options: Options<T, D, I>
  ) => create<T, D, I>(mergeOptions(baseOptions, options))

  const createMethod =
    (method: string): RequestMethod<Payload, Data, Input> =>
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
  type ResponsePromise,
  type OptionsPayload as Payload,
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
