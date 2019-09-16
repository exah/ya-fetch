import SimplerFetch from './index'

describe('create', () => {
  it('should create new instance', () => {
    const fetch = SimplerFetch.create()

    expect(fetch).toBeInstanceOf(Function)
    expect(fetch.create).toBeInstanceOf(Function)
    expect(fetch.extend).toBeInstanceOf(Function)
    expect(fetch.get).toBeInstanceOf(Function)
    expect(fetch.post).toBeInstanceOf(Function)
    expect(fetch.put).toBeInstanceOf(Function)
    expect(fetch.patch).toBeInstanceOf(Function)
    expect(fetch.delete).toBeInstanceOf(Function)
    expect(fetch.head).toBeInstanceOf(Function)

    expect(fetch.options).toBeUndefined()
  })
})

describe('extend', () => {
  it.todo('should extend instance')
})

describe('request', () => {
  it.todo('request query')
  it.todo('request json')

  it.todo('response query')
  it.todo('response json')
  it.todo('response formData')
  it.todo('response arrayBuffer')
  it.todo('response blob')

  it.todo('timeout')
  it.todo('cancel')

  it.todo('get')
  it.todo('post')
  it.todo('put')
  it.todo('patch')
  it.todo('delete')
  it.todo('head')
})
