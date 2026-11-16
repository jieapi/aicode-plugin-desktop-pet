<template>
  <div class="page-content">
    <aicode-group title="桌面宠物">
      <div class="row">
        <div class="row-main">
          <div class="row-title">{{ statusTitle }}</div>
          <p class="row-subtitle">{{ statusText }}</p>
        </div>
        <aicode-badge :text="running ? '已打开' : '未打开'" :kind="running ? 'enabled' : ''" />
      </div>
      <aicode-divider />
      <div class="actions">
        <aicode-button variant="primary" :disabled="busy" @click="showPet">显示桌宠</aicode-button>
        <aicode-button :disabled="busy || !running" @click="hidePet">关闭桌宠</aicode-button>
      </div>
    </aicode-group>

    <aicode-group title="外观">
      <div class="field-block">
        <div class="field-title">大小</div>
        <aicode-segmented
          :model-value="size"
          :options="SIZE_OPTIONS"
          @update:model-value="onSizeChange"
        />
      </div>
      <aicode-divider />
      <div class="field-block">
        <div class="field-title">显示时机</div>
        <aicode-segmented
          :model-value="visibilityPolicy"
          :options="VISIBILITY_OPTIONS"
          @update:model-value="onVisibilityChange"
        />
      </div>
    </aicode-group>

    <aicode-group title="启动">
      <div class="row">
        <div class="row-main">
          <div class="row-title">随 App 启动显示桌宠</div>
          <p class="row-subtitle">开启后，启用插件或下次启动 AiCode 时自动显示。</p>
        </div>
        <aicode-switch :model-value="autoStart" @update:model-value="onAutoStartChange" />
      </div>
    </aicode-group>

    <p class="hint">
      桌宠由宿主托管悬浮窗显示；需要先在「插件管理」中授予悬浮窗权限，并允许 AiCode 显示在其他应用上层。
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

const SETTINGS_PATH = 'data://pet-settings.json';

type VisibilityPolicy = 'always' | 'foreground' | 'background';
type SizeKey = 'small' | 'medium' | 'large';

interface PetSettings {
  autoStart: boolean;
  width: number;
  height: number;
  visibilityPolicy: VisibilityPolicy;
}

interface OverlayStatus {
  ok: boolean;
  overlayId: string | null;
  state: string;
}

const SIZES: Record<SizeKey, { width: number; height: number }> = {
  small: { width: 90, height: 110 },
  medium: { width: 110, height: 130 },
  large: { width: 150, height: 180 }
};

const SIZE_OPTIONS = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' }
];

const VISIBILITY_OPTIONS = [
  { value: 'always', label: '始终显示' },
  { value: 'foreground', label: '仅前台' },
  { value: 'background', label: '仅后台' }
];

const STATE_LABELS: Record<string, string> = {
  idle: '待机',
  thinking: '思考中',
  working: '工作中',
  feeding: '吃饭中',
  success: '开心',
  error: '沮丧',
  sleep: '休息中'
};

const autoStart = ref(false);
const size = ref<SizeKey>('medium');
const visibilityPolicy = ref<VisibilityPolicy>('always');
const overlayId = ref<string | null>(null);
const petState = ref('idle');
const busy = ref(false);

let offLifecycle: (() => void) | null = null;

const running = computed(() => !!overlayId.value);
const statusTitle = computed(() => (running.value ? '桌宠已打开' : '桌宠未打开'));
const statusText = computed(() =>
  running.value ? `当前状态：${STATE_LABELS[petState.value] ?? petState.value}` : '关闭后可以随时从下方重新打开。'
);

function toast(message: string): void {
  aicode.toast(message).catch(() => undefined);
}

function errorText(error: unknown): string {
  const value = error as { message?: string; code?: string } | null;
  return value?.message || value?.code || '未知错误';
}

function sizeOf(width: number, height: number): SizeKey {
  const found = (Object.keys(SIZES) as SizeKey[]).find(
    (key) => SIZES[key].width === Number(width) && SIZES[key].height === Number(height)
  );
  return found ?? 'medium';
}

function dimensions(): { width: number; height: number } {
  return SIZES[size.value] ?? SIZES.medium;
}

async function loadSettings(): Promise<void> {
  try {
    const file = await aicode.fs.read(SETTINGS_PATH);
    const parsed = JSON.parse(file.content || '{}') as Partial<PetSettings>;
    autoStart.value = parsed.autoStart === true;
    size.value = sizeOf(Number(parsed.width), Number(parsed.height));
    visibilityPolicy.value = VISIBILITY_OPTIONS.some((option) => option.value === parsed.visibilityPolicy)
      ? (parsed.visibilityPolicy as VisibilityPolicy)
      : 'always';
  } catch {
    // 首次使用时还没有设置文件。
  }
}

function saveSettings(): Promise<void> {
  const { width, height } = dimensions();
  return aicode.fs.write(
    SETTINGS_PATH,
    JSON.stringify({
      autoStart: autoStart.value,
      width,
      height,
      visibilityPolicy: visibilityPolicy.value
    } satisfies PetSettings)
  );
}

async function refreshStatus(): Promise<void> {
  try {
    const status = await aicode.invoke<OverlayStatus>('overlay.status');
    overlayId.value = status?.overlayId ?? null;
    petState.value = status?.state ?? 'idle';
  } catch {
    overlayId.value = null;
    petState.value = 'idle';
  }
}

async function showPet(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  const target = dimensions();
  try {
    const info = await aicode.overlay.create({
      surface: 'pet',
      width: target.width,
      height: target.height,
      visibilityPolicy: visibilityPolicy.value
    });
    overlayId.value = info.overlayId;
    petState.value = 'idle';
    if (
      info.width !== target.width ||
      info.height !== target.height ||
      info.visibilityPolicy !== visibilityPolicy.value
    ) {
      await aicode.overlay.update(info.overlayId, {
        width: target.width,
        height: target.height,
        visibilityPolicy: visibilityPolicy.value
      });
    }
    await aicode.invoke('overlay.created', { overlayId: overlayId.value }).catch(() => undefined);
    toast('桌宠已显示');
  } catch (error) {
    overlayId.value = null;
    toast('显示失败：' + errorText(error));
  } finally {
    busy.value = false;
  }
}

async function hidePet(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    await aicode.overlay.close(overlayId.value ?? undefined).catch((error: { code?: string }) => {
      if (error?.code !== 'OVERLAY_NOT_FOUND') throw error;
    });
    overlayId.value = null;
    petState.value = 'idle';
    await aicode.invoke('overlay.closed').catch(() => undefined);
    toast('桌宠已关闭');
  } catch (error) {
    toast('关闭失败：' + errorText(error));
  } finally {
    busy.value = false;
  }
}

async function onAutoStartChange(value: boolean): Promise<void> {
  const previous = autoStart.value;
  autoStart.value = value;
  try {
    await saveSettings();
    toast(value ? '已开启随 App 启动' : '已关闭随 App 启动');
  } catch (error) {
    autoStart.value = previous;
    toast('保存设置失败：' + errorText(error));
  }
}

async function onSizeChange(value: string): Promise<void> {
  const previous = size.value;
  size.value = value as SizeKey;
  const target = dimensions();
  try {
    if (overlayId.value) {
      await aicode.overlay.update(overlayId.value, { width: target.width, height: target.height });
    }
    await saveSettings();
  } catch (error) {
    size.value = previous;
    toast('调整大小失败：' + errorText(error));
  }
}

async function onVisibilityChange(value: string): Promise<void> {
  const previous = visibilityPolicy.value;
  visibilityPolicy.value = value as VisibilityPolicy;
  try {
    if (overlayId.value) {
      await aicode.overlay.update(overlayId.value, { visibilityPolicy: visibilityPolicy.value });
    }
    await saveSettings();
  } catch (error) {
    visibilityPolicy.value = previous;
    toast('调整显示时机失败：' + errorText(error));
  }
}

onMounted(async () => {
  await loadSettings();
  await refreshStatus();
  offLifecycle = aicode.events.on((event) => {
    if (event?.name === 'ui.lifecycle' && (event.payload as { visible?: boolean })?.visible) {
      void refreshStatus();
    }
  });
});

onUnmounted(() => {
  offLifecycle?.();
});
</script>

<style>
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--aicode-page-bg);
  color: var(--aicode-on-surface);
  font-family: var(--aicode-font-sans);
  font-size: calc(14px * var(--aicode-font-scale));
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}
.page-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 860px;
  margin: 0 auto;
  padding: 12px 16px 36px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
}
.row-main {
  flex: 1;
  min-width: 0;
}
.row-title {
  color: var(--aicode-on-surface);
  font-size: calc(16px * var(--aicode-font-scale));
  line-height: 1.4;
}
.row-subtitle {
  margin: 2px 0 0;
  color: var(--aicode-on-surface-variant);
  font-size: calc(14px * var(--aicode-font-scale));
  line-height: 1.4;
}
.actions {
  display: flex;
  gap: 12px;
  padding: 12px 16px 16px;
}
.actions .aicode-button { flex: 1; }
.field-block { padding: 12px 16px; }
.field-title {
  margin-bottom: 8px;
  color: var(--aicode-on-surface-variant);
  font-size: calc(13px * var(--aicode-font-scale));
}
.hint {
  margin: 0;
  padding: 0 4px;
  color: var(--aicode-on-surface-variant);
  font-size: calc(13px * var(--aicode-font-scale));
  line-height: 1.6;
}
</style>
