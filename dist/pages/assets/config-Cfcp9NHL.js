import { d as defineComponent, r as ref, c as computed, o as onMounted, a as onUnmounted, b as resolveComponent, e as openBlock, f as createElementBlock, g as createVNode, w as withCtx, h as createElementVNode, t as toDisplayString, i as createTextVNode, j as createApp } from "./_aicode-vue-global-D5aP-_-r.js";
const _hoisted_1 = { class: "page-content" };
const _hoisted_2 = { class: "row" };
const _hoisted_3 = { class: "row-main" };
const _hoisted_4 = { class: "row-title" };
const _hoisted_5 = { class: "row-subtitle" };
const _hoisted_6 = { class: "actions" };
const _hoisted_7 = { class: "field-block" };
const _hoisted_8 = { class: "field-block" };
const _hoisted_9 = { class: "row" };
const SETTINGS_PATH = "data://pet-settings.json";
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "config",
  setup(__props) {
    const SIZES = {
      small: { width: 90, height: 110 },
      medium: { width: 110, height: 130 },
      large: { width: 150, height: 180 }
    };
    const SIZE_OPTIONS = [
      { value: "small", label: "小" },
      { value: "medium", label: "中" },
      { value: "large", label: "大" }
    ];
    const VISIBILITY_OPTIONS = [
      { value: "always", label: "始终显示" },
      { value: "foreground", label: "仅前台" },
      { value: "background", label: "仅后台" }
    ];
    const STATE_LABELS = {
      idle: "待机",
      thinking: "思考中",
      working: "工作中",
      feeding: "吃饭中",
      success: "开心",
      error: "沮丧",
      sleep: "休息中"
    };
    const autoStart = ref(false);
    const size = ref("medium");
    const visibilityPolicy = ref("always");
    const overlayId = ref(null);
    const petState = ref("idle");
    const busy = ref(false);
    let offLifecycle = null;
    const running = computed(() => !!overlayId.value);
    const statusTitle = computed(() => running.value ? "桌宠已打开" : "桌宠未打开");
    const statusText = computed(
      () => {
        var _a;
        return running.value ? `当前状态：${(_a = STATE_LABELS[petState.value]) != null ? _a : petState.value}` : "关闭后可以随时从下方重新打开。";
      }
    );
    function toast(message) {
      aicode.toast(message).catch(() => void 0);
    }
    function errorText(error) {
      const value = error;
      return (value == null ? void 0 : value.message) || (value == null ? void 0 : value.code) || "未知错误";
    }
    function sizeOf(width, height) {
      const found = Object.keys(SIZES).find(
        (key) => SIZES[key].width === Number(width) && SIZES[key].height === Number(height)
      );
      return found != null ? found : "medium";
    }
    function dimensions() {
      var _a;
      return (_a = SIZES[size.value]) != null ? _a : SIZES.medium;
    }
    async function loadSettings() {
      try {
        const file = await aicode.fs.read(SETTINGS_PATH);
        const parsed = JSON.parse(file.content || "{}");
        autoStart.value = parsed.autoStart === true;
        size.value = sizeOf(Number(parsed.width), Number(parsed.height));
        visibilityPolicy.value = VISIBILITY_OPTIONS.some((option) => option.value === parsed.visibilityPolicy) ? parsed.visibilityPolicy : "always";
      } catch (e) {
      }
    }
    function saveSettings() {
      const { width, height } = dimensions();
      return aicode.fs.write(
        SETTINGS_PATH,
        JSON.stringify({
          autoStart: autoStart.value,
          width,
          height,
          visibilityPolicy: visibilityPolicy.value
        })
      );
    }
    async function refreshStatus() {
      var _a, _b;
      try {
        const status = await aicode.invoke("overlay.status");
        overlayId.value = (_a = status == null ? void 0 : status.overlayId) != null ? _a : null;
        petState.value = (_b = status == null ? void 0 : status.state) != null ? _b : "idle";
      } catch (e) {
        overlayId.value = null;
        petState.value = "idle";
      }
    }
    async function showPet() {
      if (busy.value) return;
      busy.value = true;
      const target = dimensions();
      try {
        const info = await aicode.overlay.create({
          surface: "pet",
          width: target.width,
          height: target.height,
          visibilityPolicy: visibilityPolicy.value
        });
        overlayId.value = info.overlayId;
        petState.value = "idle";
        if (info.width !== target.width || info.height !== target.height || info.visibilityPolicy !== visibilityPolicy.value) {
          await aicode.overlay.update(info.overlayId, {
            width: target.width,
            height: target.height,
            visibilityPolicy: visibilityPolicy.value
          });
        }
        await aicode.invoke("overlay.created", { overlayId: overlayId.value }).catch(() => void 0);
        toast("桌宠已显示");
      } catch (error) {
        overlayId.value = null;
        toast("显示失败：" + errorText(error));
      } finally {
        busy.value = false;
      }
    }
    async function hidePet() {
      var _a;
      if (busy.value) return;
      busy.value = true;
      try {
        await aicode.overlay.close((_a = overlayId.value) != null ? _a : void 0).catch((error) => {
          if ((error == null ? void 0 : error.code) !== "OVERLAY_NOT_FOUND") throw error;
        });
        overlayId.value = null;
        petState.value = "idle";
        await aicode.invoke("overlay.closed").catch(() => void 0);
        toast("桌宠已关闭");
      } catch (error) {
        toast("关闭失败：" + errorText(error));
      } finally {
        busy.value = false;
      }
    }
    async function onAutoStartChange(value) {
      const previous = autoStart.value;
      autoStart.value = value;
      try {
        await saveSettings();
        toast(value ? "已开启随 App 启动" : "已关闭随 App 启动");
      } catch (error) {
        autoStart.value = previous;
        toast("保存设置失败：" + errorText(error));
      }
    }
    async function onSizeChange(value) {
      const previous = size.value;
      size.value = value;
      const target = dimensions();
      try {
        if (overlayId.value) {
          await aicode.overlay.update(overlayId.value, { width: target.width, height: target.height });
        }
        await saveSettings();
      } catch (error) {
        size.value = previous;
        toast("调整大小失败：" + errorText(error));
      }
    }
    async function onVisibilityChange(value) {
      const previous = visibilityPolicy.value;
      visibilityPolicy.value = value;
      try {
        if (overlayId.value) {
          await aicode.overlay.update(overlayId.value, { visibilityPolicy: visibilityPolicy.value });
        }
        await saveSettings();
      } catch (error) {
        visibilityPolicy.value = previous;
        toast("调整显示时机失败：" + errorText(error));
      }
    }
    onMounted(async () => {
      await loadSettings();
      await refreshStatus();
      offLifecycle = aicode.events.on((event) => {
        var _a;
        if ((event == null ? void 0 : event.name) === "ui.lifecycle" && ((_a = event.payload) == null ? void 0 : _a.visible)) {
          void refreshStatus();
        }
      });
    });
    onUnmounted(() => {
      offLifecycle == null ? void 0 : offLifecycle();
    });
    return (_ctx, _cache) => {
      const _component_aicode_badge = resolveComponent("aicode-badge");
      const _component_aicode_divider = resolveComponent("aicode-divider");
      const _component_aicode_button = resolveComponent("aicode-button");
      const _component_aicode_group = resolveComponent("aicode-group");
      const _component_aicode_segmented = resolveComponent("aicode-segmented");
      const _component_aicode_switch = resolveComponent("aicode-switch");
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createVNode(_component_aicode_group, { title: "桌面宠物" }, {
          default: withCtx(() => [
            createElementVNode("div", _hoisted_2, [
              createElementVNode("div", _hoisted_3, [
                createElementVNode(
                  "div",
                  _hoisted_4,
                  toDisplayString(statusTitle.value),
                  1
                  /* TEXT */
                ),
                createElementVNode(
                  "p",
                  _hoisted_5,
                  toDisplayString(statusText.value),
                  1
                  /* TEXT */
                )
              ]),
              createVNode(_component_aicode_badge, {
                text: running.value ? "已打开" : "未打开",
                kind: running.value ? "enabled" : ""
              }, null, 8, ["text", "kind"])
            ]),
            createVNode(_component_aicode_divider),
            createElementVNode("div", _hoisted_6, [
              createVNode(_component_aicode_button, {
                variant: "primary",
                disabled: busy.value,
                onClick: showPet
              }, {
                default: withCtx(() => [..._cache[0] || (_cache[0] = [
                  createTextVNode(
                    "显示桌宠",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["disabled"]),
              createVNode(_component_aicode_button, {
                disabled: busy.value || !running.value,
                onClick: hidePet
              }, {
                default: withCtx(() => [..._cache[1] || (_cache[1] = [
                  createTextVNode(
                    "关闭桌宠",
                    -1
                    /* CACHED */
                  )
                ])]),
                _: 1
                /* STABLE */
              }, 8, ["disabled"])
            ])
          ]),
          _: 1
          /* STABLE */
        }),
        createVNode(_component_aicode_group, { title: "外观" }, {
          default: withCtx(() => [
            createElementVNode("div", _hoisted_7, [
              _cache[2] || (_cache[2] = createElementVNode(
                "div",
                { class: "field-title" },
                "大小",
                -1
                /* CACHED */
              )),
              createVNode(_component_aicode_segmented, {
                "model-value": size.value,
                options: SIZE_OPTIONS,
                "onUpdate:modelValue": onSizeChange
              }, null, 8, ["model-value"])
            ]),
            createVNode(_component_aicode_divider),
            createElementVNode("div", _hoisted_8, [
              _cache[3] || (_cache[3] = createElementVNode(
                "div",
                { class: "field-title" },
                "显示时机",
                -1
                /* CACHED */
              )),
              createVNode(_component_aicode_segmented, {
                "model-value": visibilityPolicy.value,
                options: VISIBILITY_OPTIONS,
                "onUpdate:modelValue": onVisibilityChange
              }, null, 8, ["model-value"])
            ])
          ]),
          _: 1
          /* STABLE */
        }),
        createVNode(_component_aicode_group, { title: "启动" }, {
          default: withCtx(() => [
            createElementVNode("div", _hoisted_9, [
              _cache[4] || (_cache[4] = createElementVNode(
                "div",
                { class: "row-main" },
                [
                  createElementVNode("div", { class: "row-title" }, "随 App 启动显示桌宠"),
                  createElementVNode("p", { class: "row-subtitle" }, "开启后，启用插件或下次启动 AiCode 时自动显示。")
                ],
                -1
                /* CACHED */
              )),
              createVNode(_component_aicode_switch, {
                "model-value": autoStart.value,
                "onUpdate:modelValue": onAutoStartChange
              }, null, 8, ["model-value"])
            ])
          ]),
          _: 1
          /* STABLE */
        }),
        _cache[5] || (_cache[5] = createElementVNode(
          "p",
          { class: "hint" },
          " 桌宠由宿主托管悬浮窗显示；需要先在「插件管理」中授予悬浮窗权限，并允许 AiCode 显示在其他应用上层。 ",
          -1
          /* CACHED */
        ))
      ]);
    };
  }
});
const app = createApp(_sfc_main);
if (window.AicodeUI) app.use(window.AicodeUI);
app.mount("#app");
