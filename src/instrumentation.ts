/**
 * Next.js sunucusu başlarken bir kez çalışır.
 *
 * Node'un yerleşik SQLite modülü (node:sqlite) "deneysel" olarak işaretlidir ve
 * ilk içe aktarıldığında bir ExperimentalWarning basar. Modül kararlıdır ve
 * burada yalnızca okunan/yazılan SQL için kullanılır; kurum kullanıcısını
 * gereksiz yere tedirgin etmemek için yalnızca bu uyarı bastırılır.
 * Diğer tüm Node uyarıları olduğu gibi görünmeye devam eder.
 */
export function register(): void {
  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const text = typeof warning === "string" ? warning : (warning?.message ?? "");
    if (text.includes("SQLite is an experimental feature")) return;
    return (original as (...a: unknown[]) => void)(warning, ...rest);
  }) as typeof process.emitWarning;
}
