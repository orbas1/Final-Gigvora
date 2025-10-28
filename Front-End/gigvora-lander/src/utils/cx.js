export function cx(...classes) {
  return classes
    .flatMap((cls) => {
      if (typeof cls === 'string') return cls
      if (Array.isArray(cls)) return cx(...cls)
      if (cls && typeof cls === 'object') {
        return Object.entries(cls)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key)
      }
      return ''
    })
    .filter(Boolean)
    .join(' ')
}
