export default function sortObject<T extends Record<any, any>>(objectToSort: T) {
  return Object.fromEntries(Object.keys(objectToSort)
    .toSorted()
    .map(key => [key, objectToSort[key]])) as T
}
