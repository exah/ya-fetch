const URL = require('url')
const fetch = require('node-fetch')
const AbortController = require('abort-controller')
const FormData = require('form-data')

global.URL = URL
global.fetch = fetch
global.Headers = fetch.Headers
global.Request = fetch.Request
global.Response = fetch.Response
global.AbortController = AbortController
global.FormData = FormData
