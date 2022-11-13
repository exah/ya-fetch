import fetch, { Headers, Request, Response, FormData } from 'node-fetch'
import AbortController from 'abort-controller'

globalThis.fetch = fetch
globalThis.Headers = Headers
globalThis.Request = Request
globalThis.Response = Response
globalThis.AbortController = AbortController
globalThis.FormData = FormData
