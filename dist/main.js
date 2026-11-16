"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@jieapi/plugin-sdk/dist/index.js
var require_dist = __commonJS({
  "node_modules/@jieapi/plugin-sdk/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.hostCall = hostCall2;
    exports2.emit = emit;
    exports2.log = log;
    exports2.definePlugin = definePlugin2;
    var readline_1 = require("readline");
    var SUPPORTED_METHODS = /* @__PURE__ */ new Set(["tool.invoke", "hook.invoke", "ui.invoke"]);
    var pending = /* @__PURE__ */ new Map();
    var hostSeq = 0;
    var started = false;
    function send(message) {
      process.stdout.write(JSON.stringify(message) + "\n");
    }
    function errorMessage2(error) {
      return String((error === null || error === void 0 ? void 0 : error.message) || error);
    }
    function errorCode2(error) {
      const code = error === null || error === void 0 ? void 0 : error.code;
      return typeof code === "string" && code ? code : "PLUGIN_ERROR";
    }
    function hostCall2(method, params) {
      const id = "host-" + ++hostSeq;
      return new Promise((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => resolve(value),
          reject
        });
        send({ jsonrpc: "2.0", id, method, params: params !== null && params !== void 0 ? params : {} });
      });
    }
    function emit(name, payload = null) {
      send({ jsonrpc: "2.0", method: "plugin.event", params: { name, payload } });
    }
    function log(message) {
      process.stderr.write("[plugin] " + message + "\n");
    }
    function handleRequest(id, method, params, handlers2) {
      if (!SUPPORTED_METHODS.has(method)) {
        send({ jsonrpc: "2.0", id, error: { code: "METHOD_UNKNOWN", message: method } });
        return;
      }
      const name = typeof params.handler === "string" ? params.handler : "";
      const handler = handlers2[name];
      if (typeof handler !== "function") {
        send({ jsonrpc: "2.0", id, error: { code: "HANDLER_NOT_FOUND", message: name } });
        return;
      }
      Promise.resolve().then(() => {
        var _a;
        return handler((_a = params.args) !== null && _a !== void 0 ? _a : {});
      }).then((result) => send({ jsonrpc: "2.0", id, result: result === void 0 ? null : result })).catch((error) => send({
        jsonrpc: "2.0",
        id,
        error: { code: errorCode2(error), message: errorMessage2(error) }
      }));
    }
    function handleResponse(message) {
      const id = String(message.id);
      const waiter = pending.get(id);
      if (!waiter)
        return;
      pending.delete(id);
      if (message.error) {
        const error = new Error(message.error.message || "host error");
        error.code = message.error.code || "HOST_ERROR";
        waiter.reject(error);
      } else {
        waiter.resolve(message.result === void 0 ? null : message.result);
      }
    }
    function definePlugin2(definition) {
      if (started)
        throw new Error("definePlugin \u53EA\u80FD\u8C03\u7528\u4E00\u6B21");
      started = true;
      const handlers2 = definition.handlers;
      (0, readline_1.createInterface)({ input: process.stdin }).on("line", (line) => {
        var _a;
        if (!line.trim())
          return;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          return;
        }
        if (message.method && message.id !== void 0) {
          handleRequest(message.id, message.method, (_a = message.params) !== null && _a !== void 0 ? _a : {}, handlers2);
        } else if (message.method) {
          return;
        } else if (message.id !== void 0) {
          handleResponse(message);
        }
      });
    }
  }
});

// src/index.ts
var import_plugin_sdk2 = __toESM(require_dist());

// src/handlers/overlay.ts
var import_plugin_sdk = __toESM(require_dist());
var SETTINGS_PATH = "data://pet-settings.json";
var IDLE_SLEEP_MS = 3 * 60 * 1e3;
var TOUCH_WAKE_CHANCE = 0.3;
var IDLE_AFTER_ACTION_MS = 3e3;
var DEFAULTS = {
  autoStart: false,
  width: 110,
  height: 130,
  visibilityPolicy: "always"
};
var overlayId = null;
var overlayGeneration = 0;
var idleTimer = null;
var sleepTimer = null;
var currentState = "idle";
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function errorCode(error) {
  const code = error == null ? void 0 : error.code;
  return typeof code === "string" && code ? code : "PLUGIN_ERROR";
}
function errorMessage(error) {
  var _a, _b;
  return String((_b = (_a = error == null ? void 0 : error.message) != null ? _a : error) != null ? _b : "unknown");
}
async function readSettings() {
  try {
    const file = await (0, import_plugin_sdk.hostCall)("host.fs.read", { path: SETTINGS_PATH });
    const parsed = JSON.parse(String(file.content || "{}"));
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}
async function autoShowPet() {
  const settings = await readSettings();
  if (settings.autoStart !== true) {
    return { ok: true, skipped: true };
  }
  const width = Number(settings.width) || DEFAULTS.width;
  const height = Number(settings.height) || DEFAULTS.height;
  const visibilityPolicy = settings.visibilityPolicy || DEFAULTS.visibilityPolicy;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const info = await (0, import_plugin_sdk.hostCall)("host.overlay.create", {
        surface: "pet",
        width,
        height,
        visibilityPolicy
      });
      overlayId = info.overlayId;
      overlayGeneration += 1;
      scheduleSleep();
      return { ok: true, overlayId: info.overlayId, width, height };
    } catch (error) {
      lastError = error;
      if (errorCode(error) === "OVERLAY_SERVICE_FAILED" && attempt < 2) {
        await sleep(1200);
        continue;
      }
      break;
    }
  }
  return { ok: false, code: errorCode(lastError) || "BOOT_FAILED", message: errorMessage(lastError) };
}
function clearOverlayState() {
  overlayGeneration += 1;
  overlayId = null;
  if (idleTimer) clearTimeout(idleTimer);
  if (sleepTimer) clearTimeout(sleepTimer);
  idleTimer = null;
  sleepTimer = null;
  if (currentState === "feeding" || currentState === "success" || currentState === "error") {
    currentState = "idle";
  }
}
function scheduleSleep() {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  if (!overlayId || currentState !== "idle") return;
  sleepTimer = setTimeout(() => {
    void postState("sleep");
  }, IDLE_SLEEP_MS);
}
async function postState(state) {
  currentState = state;
  if (!overlayId) {
    return { ok: false, code: "OVERLAY_NOT_FOUND", state };
  }
  const generation = overlayGeneration;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  scheduleSleep();
  try {
    await (0, import_plugin_sdk.hostCall)("host.overlay.postMessage", {
      surface: "pet",
      payload: { type: "state", state }
    });
    return { ok: true, state, logs: ["pet state -> " + state] };
  } catch (error) {
    if (errorCode(error) === "OVERLAY_NOT_FOUND" && generation === overlayGeneration) {
      clearOverlayState();
    }
    return {
      ok: false,
      code: errorCode(error),
      state,
      logs: ["pet state failed -> " + errorCode(error)]
    };
  }
}
function scheduleIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void postState("idle");
  }, IDLE_AFTER_ACTION_MS);
}
async function postHint(text) {
  try {
    await (0, import_plugin_sdk.hostCall)("host.overlay.postMessage", {
      surface: "pet",
      payload: { type: "hint", text }
    });
  } catch {
  }
}
async function handleMenuAction(action) {
  if (action === "feed") {
    const result = postState("feeding");
    scheduleIdle();
    await result;
    await postHint("\u597D\u5403\uFF01");
  } else if (action === "sleep") {
    await postState("sleep");
    await postHint("\u665A\u5B89\u2026");
  } else if (action === "hide") {
    clearOverlayState();
    try {
      await (0, import_plugin_sdk.hostCall)("host.overlay.close", { surface: "pet" });
    } catch {
    }
  }
  return { ok: true };
}
function adoptOverlay(overlayIdValue) {
  if (overlayIdValue) overlayId = String(overlayIdValue);
  overlayGeneration += 1;
  scheduleSleep();
}
function handleOverlayMessage(args) {
  var _a, _b, _c;
  const payload = (_a = args.payload) != null ? _a : {};
  const type = String((_b = payload.type) != null ? _b : "");
  if (type === "menuAction") return handleMenuAction(String((_c = payload.action) != null ? _c : ""));
  if (type === "petReady") {
    adoptOverlay(args.overlayId);
    return (0, import_plugin_sdk.hostCall)("host.overlay.postMessage", {
      surface: "pet",
      payload: { type: "state", state: currentState }
    });
  }
  if (type === "activity") {
    scheduleSleep();
    return { ok: true };
  }
  if (type === "pet") {
    if (currentState !== "sleep") {
      scheduleSleep();
      return { ok: true };
    }
    if (Math.random() < TOUCH_WAKE_CHANCE) {
      void postState("idle").then(() => postHint("\u9192\u5566\uFF0C\u966A\u4F60\u4E00\u4F1A\u513F"));
    } else {
      void postHint("\u547C\u565C\u2026");
    }
  }
  return { ok: true };
}
var handlers = {
  "hooks.boot": () => autoShowPet(),
  "hooks.pluginEnabled": () => autoShowPet(),
  "hooks.agentRunStarted": () => postState("thinking"),
  "hooks.agentToolStarted": () => postState("working"),
  "hooks.agentToolFinished": () => postState("working"),
  "hooks.agentRunFinished": (args) => {
    var _a;
    const status = String((_a = args.status) != null ? _a : "");
    const state = status === "success" ? "success" : status === "cancelled" ? "idle" : "error";
    const result = postState(state);
    if (state !== "idle") scheduleIdle();
    return result;
  },
  /** 配置页读取当前浮层，用于展示状态与关闭按钮。 */
  "overlay.status": () => ({ ok: true, overlayId, state: currentState }),
  /** 配置页手动创建/关闭浮层时同步给常驻进程。 */
  "overlay.created": (args) => {
    adoptOverlay(args.overlayId);
    return { ok: true };
  },
  "overlay.closed": () => {
    clearOverlayState();
    return { ok: true };
  },
  "overlay.message": (args) => handleOverlayMessage(args)
};

// src/index.ts
(0, import_plugin_sdk2.definePlugin)({ handlers });
