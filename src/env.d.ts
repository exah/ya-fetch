interface ObjectConstructor {
  entries<K, V>(o: Record<K, V>): Array<[`${K}`, V]>
}
