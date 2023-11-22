interface ObjectConstructor {
  entries<K extends string | number, V>(o: Record<K, V>): Array<[`${K}`, V]>
}
