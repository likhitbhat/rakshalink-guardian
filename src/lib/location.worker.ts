/// <reference lib="webworker" />
/**
 * RakshaLink location worker.
 *
 * IMPORTANT browser constraint: the Geolocation API (`navigator.geolocation`)
 * is only available on the main thread — it does NOT exist inside a Web
 * Worker. So this worker cannot read GPS directly. Instead it runs as an
 * independent scheduler that lives off the main thread:
 *
 *   - It owns the polling cadence (10s active / 30s background) so timing is
 *     isolated from React re-renders and main-thread work.
 *   - On each tick it posts a "tick" message; the main thread responds by
 *     reading geolocation and writing the fix to Supabase live_locations.
 *   - It answers "ping" with "pong" so the main thread can detect a crash and
 *     restart the worker.
 */

let timer: ReturnType<typeof setInterval> | null = null;
let intervalMs = 10000;

const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);

function startLoop() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => post({ type: "tick" }), intervalMs);
}

self.onmessage = (e: MessageEvent) => {
  const msg = e.data as { type: string; interval?: number };
  switch (msg?.type) {
    case "start":
      if (typeof msg.interval === "number") intervalMs = msg.interval;
      post({ type: "tick" }); // immediate first fix
      startLoop();
      break;
    case "setInterval":
      if (typeof msg.interval === "number") intervalMs = msg.interval;
      startLoop();
      break;
    case "stop":
      if (timer) clearInterval(timer);
      timer = null;
      break;
    case "ping":
      post({ type: "pong" });
      break;
  }
};

export {};
