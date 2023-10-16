interface ObjectConstructor {
  entries<K extends string | number, V>(o: Record<K, V>): Array<[`${K}`, V]>
}

declare let Response: {
  prototype: Response
  new (body?: BodyInit | null, init?: ResponseInit): Response
  error(): Response
  redirect(url: string | URL, status?: number): Response
  json(body: unknown, init?: ResponseInit): Response
}
