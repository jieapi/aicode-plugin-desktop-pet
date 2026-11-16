import { hostCall, type PluginArgs, type PluginHandler } from '@jieapi/plugin-sdk';

/** 设置与浮层状态都存在插件私有目录，随插件卸载一起清掉。 */
const SETTINGS_PATH = 'data://pet-settings.json';
/** 空闲多久进入睡眠。 */
const IDLE_SLEEP_MS = 3 * 60 * 1000;
/** 睡眠时被点醒的概率。 */
const TOUCH_WAKE_CHANCE = 0.3;
/** 一次动作结束后回到待机的延迟。 */
const IDLE_AFTER_ACTION_MS = 3000;

type VisibilityPolicy = 'always' | 'foreground' | 'background';
type PetState = 'idle' | 'thinking' | 'working' | 'feeding' | 'success' | 'error' | 'sleep';

interface PetSettings {
  autoStart: boolean;
  width: number;
  height: number;
  visibilityPolicy: VisibilityPolicy;
}

interface OverlayInfo {
  overlayId: string;
  width: number;
  height: number;
}

const DEFAULTS: PetSettings = {
  autoStart: false,
  width: 110,
  height: 130,
  visibilityPolicy: 'always'
};

let overlayId: string | null = null;
let overlayGeneration = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;
let currentState: PetState = 'idle';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code ? code : 'PLUGIN_ERROR';
}

function errorMessage(error: unknown): string {
  return String((error as { message?: unknown } | null)?.message ?? error ?? 'unknown');
}

async function readSettings(): Promise<PetSettings> {
  try {
    const file = await hostCall<{ content: string }>('host.fs.read', { path: SETTINGS_PATH });
    const parsed = JSON.parse(String(file.content || '{}')) as Partial<PetSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * 启动或启用插件时创建浮层。此时 App 可能还没进入前台，前台服务被系统挡掉时短暂重试。
 */
async function autoShowPet(): Promise<unknown> {
  const settings = await readSettings();
  if (settings.autoStart !== true) {
    return { ok: true, skipped: true };
  }
  const width = Number(settings.width) || DEFAULTS.width;
  const height = Number(settings.height) || DEFAULTS.height;
  const visibilityPolicy = settings.visibilityPolicy || DEFAULTS.visibilityPolicy;

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const info = await hostCall<OverlayInfo>('host.overlay.create', {
        surface: 'pet',
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
      if (errorCode(error) === 'OVERLAY_SERVICE_FAILED' && attempt < 2) {
        await sleep(1200);
        continue;
      }
      break;
    }
  }
  return { ok: false, code: errorCode(lastError) || 'BOOT_FAILED', message: errorMessage(lastError) };
}

function clearOverlayState(): void {
  overlayGeneration += 1;
  overlayId = null;
  if (idleTimer) clearTimeout(idleTimer);
  if (sleepTimer) clearTimeout(sleepTimer);
  idleTimer = null;
  sleepTimer = null;
  if (currentState === 'feeding' || currentState === 'success' || currentState === 'error') {
    currentState = 'idle';
  }
}

function scheduleSleep(): void {
  if (sleepTimer) clearTimeout(sleepTimer);
  sleepTimer = null;
  if (!overlayId || currentState !== 'idle') return;
  sleepTimer = setTimeout(() => {
    void postState('sleep');
  }, IDLE_SLEEP_MS);
}

async function postState(state: PetState): Promise<unknown> {
  currentState = state;
  if (!overlayId) {
    return { ok: false, code: 'OVERLAY_NOT_FOUND', state };
  }
  const generation = overlayGeneration;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  scheduleSleep();
  try {
    await hostCall('host.overlay.postMessage', {
      surface: 'pet',
      payload: { type: 'state', state }
    });
    return { ok: true, state, logs: ['pet state -> ' + state] };
  } catch (error) {
    // 旧窗口迟到的不存在错误不能影响新窗口的计时。
    if (errorCode(error) === 'OVERLAY_NOT_FOUND' && generation === overlayGeneration) {
      clearOverlayState();
    }
    return {
      ok: false,
      code: errorCode(error),
      state,
      logs: ['pet state failed -> ' + errorCode(error)]
    };
  }
}

function scheduleIdle(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    void postState('idle');
  }, IDLE_AFTER_ACTION_MS);
}

async function postHint(text: string): Promise<void> {
  try {
    await hostCall('host.overlay.postMessage', {
      surface: 'pet',
      payload: { type: 'hint', text }
    });
  } catch {
    // 浮层已关闭时忽略。
  }
}

async function handleMenuAction(action: string): Promise<unknown> {
  if (action === 'feed') {
    const result = postState('feeding');
    scheduleIdle();
    await result;
    await postHint('好吃！');
  } else if (action === 'sleep') {
    await postState('sleep');
    await postHint('晚安…');
  } else if (action === 'hide') {
    clearOverlayState();
    try {
      await hostCall('host.overlay.close', { surface: 'pet' });
    } catch {
      // 已关闭。
    }
  }
  return { ok: true };
}

function adoptOverlay(overlayIdValue: unknown): void {
  if (overlayIdValue) overlayId = String(overlayIdValue);
  overlayGeneration += 1;
  scheduleSleep();
}

function handleOverlayMessage(args: PluginArgs): Promise<unknown> | unknown {
  const payload = (args.payload ?? {}) as Record<string, unknown>;
  const type = String(payload.type ?? '');

  if (type === 'menuAction') return handleMenuAction(String(payload.action ?? ''));
  if (type === 'petReady') {
    adoptOverlay(args.overlayId);
    return hostCall('host.overlay.postMessage', {
      surface: 'pet',
      payload: { type: 'state', state: currentState }
    });
  }
  if (type === 'activity') {
    scheduleSleep();
    return { ok: true };
  }
  if (type === 'pet') {
    if (currentState !== 'sleep') {
      scheduleSleep();
      return { ok: true };
    }
    if (Math.random() < TOUCH_WAKE_CHANCE) {
      void postState('idle').then(() => postHint('醒啦，陪你一会儿'));
    } else {
      void postHint('呼噜…');
    }
  }
  return { ok: true };
}

export const handlers: Record<string, PluginHandler> = {
  'hooks.boot': () => autoShowPet(),
  'hooks.pluginEnabled': () => autoShowPet(),
  'hooks.agentRunStarted': () => postState('thinking'),
  'hooks.agentToolStarted': () => postState('working'),
  'hooks.agentToolFinished': () => postState('working'),
  'hooks.agentRunFinished': (args) => {
    const status = String(args.status ?? '');
    const state: PetState = status === 'success' ? 'success' : status === 'cancelled' ? 'idle' : 'error';
    const result = postState(state);
    if (state !== 'idle') scheduleIdle();
    return result;
  },
  /** 配置页读取当前浮层，用于展示状态与关闭按钮。 */
  'overlay.status': () => ({ ok: true, overlayId, state: currentState }),
  /** 配置页手动创建/关闭浮层时同步给常驻进程。 */
  'overlay.created': (args) => {
    adoptOverlay(args.overlayId);
    return { ok: true };
  },
  'overlay.closed': () => {
    clearOverlayState();
    return { ok: true };
  },
  'overlay.message': (args) => handleOverlayMessage(args)
};
