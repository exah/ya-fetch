type RequestMethods = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'HEAD' | 'DELETE'
type ContentTypes = 'json' | 'text' | 'formData' | 'arrayBuffer' | 'blob'

type Headers = Record<string, string>
type Params = Record<string, any>

interface ResponseBody extends Promise<Response> {
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
  params?: Params
  /** Throw `TimeoutError`if timeout is passed */
  timeout?: number
  /** String that will prepended to `resource` in `fetch` instance */
  prefixUrl?: string
  /** Request headers */
  headers?: Headers
  /** Custom params serializer, default to `URLSearchParams` */
  serialize?(params: Params): URLSearchParams | string
  /** Response handler, must handle status codes or throw `ResponseError` */
  onResponse?(
    response: Response,
    options: Options
  ): Response | never | Promise<never>
  /** Response handler with sucess status codes 200-299 */
  onSuccess?(value: Response): Response | Promise<Response>
  /** Error handler, must throw an `Error` */
  onFailure?(error: ResponseError): never | Promise<never>
}

interface Request {
  (resource: string, options?: Options): ResponseBody
}

interface Instance extends Request {
  create(options?: Options): Instance
  extend(options?: Options): Instance
  options: Options
  get: Request
  post: Request
  put: Request
  patch: Request
  head: Request
  delete: Request
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

const CONTENT_TYPES: Record<ContentTypes, string> = {
  json: 'application/json',
  text: 'text/*',
  formData: 'multipart/form-data',
  arrayBuffer: '*/*',
  blob: '*/*',
} as const

const ERROR_NAMES = {
  Response: 'ResponseError',
  Timeout: 'TimeoutError',
  Abort: 'AbortError',
} as const

const DEFAULTS: Options = {
  prefixUrl: '',
  credentials: 'same-origin',
  serialize(params: Record<string, any>) {
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
}

const { keys, assign } = Object
const merge = <T>(a?: T, b?: T): T => assign({}, a, b)

const mergeOptions = (left: Options = {}, right: Options = {}) =>
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
    response: response,
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

function request(baseResource: string, baseOptions: Options): ResponseBody {
  const opts = mergeOptions(DEFAULTS, baseOptions)
  const query = keys(opts.params).length
    ? '?' + opts.serialize(opts.params)
    : ''

  const resource = opts.prefixUrl + baseResource + query

  if (opts.json != null) {
    opts.body = JSON.stringify(opts.json)
    opts.headers['content-type'] = CONTENT_TYPES.json
  }

  const promise: ResponseBody = new Promise<Response>((resolve, reject) => {
    let timerID: any

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
      fetch(resource, opts)
        .then((response) => opts.onResponse(response, opts))
        .then(resolve, reject)
        .then(() => clearTimeout(timerID))
    )
  }).then(opts.onSuccess, opts.onFailure)

  return (keys(CONTENT_TYPES) as ContentTypes[]).reduce<ResponseBody>(
    (acc, key) => {
      acc[key] = () => {
        opts.headers.accept = CONTENT_TYPES[key]
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

  return assign(intance.get, intance)
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
