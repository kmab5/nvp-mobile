/**
 * Guarded access to native modules.
 *
 * A bare `import` of a native module runs at module-evaluation time, before any
 * React component mounts and before any error boundary exists. If the module is
 * missing or mismatched — the wrong Expo Go version, a dependency that didn't
 * link, a stale dev build after adding a package — the whole bundle throws and
 * the app shows a blank screen with nothing useful on it.
 *
 * Loading them through here instead means a missing module degrades to a
 * documented fallback and a recorded warning that the app can display, rather
 * than a silent failure to boot.
 */

const warnings = [];

/**
 * @param {string} name  package name, for the warning message
 * @param {() => any} load  the require call
 * @param {any} fallback  used when the module isn't available
 */
export function optional(name, load, fallback = null) {
  try {
    const module = load();
    // A native module that failed to link often resolves to an empty object.
    if (!module || (typeof module === 'object' && Object.keys(module).length === 0)) {
      throw new Error('module resolved but appears empty (native side not linked?)');
    }
    return module;
  } catch (error) {
    warnings.push(`${name}: ${error.message}`);
    if (__DEV__) console.warn(`[nvp] ${name} unavailable — ${error.message}`);
    return fallback;
  }
}

export function nativeWarnings() {
  return [...warnings];
}
