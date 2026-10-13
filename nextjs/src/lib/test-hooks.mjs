/**
 * Node's type-stripping test runner resolves relative imports exactly.
 * App code uses extensionless paths. Append .ts for those specifiers.
 */
export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../')
  const hasExtension = /\.[a-z0-9]+$/i.test(specifier)
  if (relative && !hasExtension) {
    try {
      return await nextResolve(`${specifier}.ts`, context)
    } catch {
      return nextResolve(specifier, context)
    }
  }
  return nextResolve(specifier, context)
}
