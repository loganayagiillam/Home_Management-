export function encodeSearchParam(value: string) {
  return encodeURIComponent(value);
}

export function decodeSearchParam(value: string | null | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function resolveSearchParams<T>(
  searchParams: T | Promise<T> | undefined,
): Promise<T | undefined> {
  if (!searchParams) return undefined;
  const maybePromise = searchParams as unknown as { then?: unknown };
  if (typeof maybePromise.then === 'function') {
    return (await searchParams) as T;
  }
  return searchParams as T;
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;
  return fallback;
}
