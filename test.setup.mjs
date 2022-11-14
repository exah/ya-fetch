import fetch, { Headers, Request, Response, FormData } from 'node-fetch'

globalThis.fetch = fetch
globalThis.Headers = Headers
globalThis.Request = Request
globalThis.Response = Response
globalThis.FormData = FormData
