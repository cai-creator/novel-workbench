/** 让 Node 直接运行仓库里的 TS 模块：解析无扩展名的相对导入。 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
      try {
        return await next(candidate, context)
      } catch (error) {
        if (error && error.code === 'ERR_MODULE_NOT_FOUND') continue
        throw error
      }
    }
  }
  return next(specifier, context)
}
