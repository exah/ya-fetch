export type RequestMethods =
  | 'GET'
  | 'POST'
  | 'PATCH'
  | 'PUT'
  | 'HEAD'
  | 'DELETE'

export type ContentTypes = 'json' | 'text' | 'formData' | 'arrayBuffer' | 'blob'

export type RequestPromise = Promise<Response> &
  Partial<Record<ContentTypes, <T>() => Promise<T>>>

type Params = Record<string, any>

export type RequestOptions = {
  json?: JSON
  params?: Params
  timeout?: number
  prefixUrl?: string
  onResponse?: (response: Response) => Response
  parseParams?: (params: Params) => string
} & RequestInit
