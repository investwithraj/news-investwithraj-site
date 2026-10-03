/** Placement is not Google's traffic-source dimension. Preserve upstream fields. */
export function googleEventProperties<T extends Record<string, unknown>>(properties: T): Record<string, unknown> {
  const { source, ...rest } = properties;
  return source === undefined ? rest : { ...rest, iwr_placement: source };
}
