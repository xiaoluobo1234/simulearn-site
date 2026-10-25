/// <reference lib="webworker" />
import { LAB_OUTPUT_LIMIT, PYODIDE_BASE, validLabRun, type LabWorkerMessage } from '../lib/python-lab';

// A fresh Worker is created for each explicit run. No account data is sent here.
const scope = self as unknown as DedicatedWorkerGlobalScope;
let used = false;
scope.onmessage = async (event: MessageEvent<unknown>) => {
  if (used || !validLabRun(event.data)) return;
  used = true;
  const { id, code, input } = event.data;
  const send = (message: LabWorkerMessage) => scope.postMessage(message);
  let count = 0;
  const stream = (name: 'stdout' | 'stderr', text: string) => {
    count += text.length;
    if (count > LAB_OUTPUT_LIMIT * 2) throw new Error('输出过多，已停止本次 Python 执行。');
    send({ type: 'stream', id, stream: name, text });
  };
  try {
    const base = new URL(PYODIDE_BASE, scope.location.origin).href;
    // Fixed first-party URL, deliberately not bundled or loaded from a CDN.
    const runtimeURL = `${base}pyodide.mjs`;
    const { loadPyodide } = await import(/* @vite-ignore */ runtimeURL);
    const py = await loadPyodide({ indexURL: base, packageBaseUrl: base,
      jsglobals: Object.freeze(Object.create(null)),
      stdout: (text: string) => stream('stdout', `${text}\n`),
      stderr: (text: string) => stream('stderr', `${text}\n`),
    });
    py.setStdin({ error: true });
    // Avoid newline batching losing print(..., end='') and cap partial lines too.
    for (const name of ['stdout', 'stderr'] as const) {
      const decoder = new TextDecoder();
      const handler = { write: (bytes: Uint8Array) => { stream(name, decoder.decode(bytes, { stream: true })); return bytes.length; } };
      if (name === 'stdout') py.setStdout(handler); else py.setStderr(handler);
    }
    const pythonVersion = String(py.runPython('import sys; sys.version.split()[0]'));
    const environment = `CPython ${pythonVersion} · Pyodide ${String(py.version)} · WebAssembly / WebWorker`;
    // Common network/child-worker APIs are denied after local runtime bootstrap.
    // This reduces accidental access; arbitrary hostile code needs stronger isolation.
    const deny = () => { throw new Error('本练习禁用网络与子 Worker；仅支持已加载的 Python 标准库。'); };
    for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'Worker', 'SharedWorker', 'importScripts']) {
      Object.defineProperty(scope, key, { value: deny, configurable: false, writable: false });
    }
    py.globals.set('input_text', input);
    send({ type: 'ready', id, environment });
    // No automatic package installation, no implicit execution on editor changes.
    const result = await py.runPythonAsync(code, { filename: '<simulearn-lab>' });
    let value = '';
    try {
      if (result !== undefined && result !== null) {
        const full = String(result), marker = '\n[表达式返回值达到上限，已截断]';
        value = full.length > 4_000 ? full.slice(0, 4_000 - marker.length) + marker : full;
      }
    }
    finally { if (result && typeof result.destroy === 'function') result.destroy(); }
    send({ type: 'done', id, value });
  } catch (error) {
    send({ type: 'error', id, error: error instanceof Error ? error.message.slice(0, LAB_OUTPUT_LIMIT) : String(error).slice(0, LAB_OUTPUT_LIMIT) });
  }
};
