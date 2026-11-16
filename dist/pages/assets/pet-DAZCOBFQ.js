import { d as defineComponent, r as ref, c as computed, k as watch, o as onMounted, a as onUnmounted, e as openBlock, f as createElementBlock, h as createElementVNode, n as normalizeClass, l as createStaticVNode, t as toDisplayString, m as nextTick, j as createApp } from "./_aicode-vue-global-D5aP-_-r.js";
const _hoisted_1 = { id: "stage" };
const _hoisted_2 = { class: "pet-scale" };
const _hoisted_3 = { class: "pet-pose" };
const _hoisted_4 = ["hidden", "aria-hidden"];
const _hoisted_5 = ["aria-hidden"];
const _hoisted_6 = ["disabled"];
const _hoisted_7 = ["disabled"];
const _hoisted_8 = ["disabled"];
const MENU_EXTRA_HEIGHT = 146;
const HINT_VISIBLE_MS = 1200;
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "pet",
  setup(__props) {
    const STATE_LABELS = {
      thinking: "思考中…",
      working: "工作中…",
      success: "完成",
      error: "出错",
      feeding: "吃饭中",
      sleep: "休息中"
    };
    const CLICK_HINTS = ["喵", "在呢", "摸摸", "今天也要写代码"];
    const petEl = ref(null);
    const petState = ref("idle");
    const edge = ref(null);
    const dragging = ref(false);
    const landing = ref(false);
    const happy = ref(false);
    const hintText = ref("拖动 / 长按");
    const hintVisible = ref(false);
    const stateLabel = ref("");
    const expanded = ref(false);
    const transitioning = ref(false);
    const selfInfo = { x: 0, y: 0, width: 110, height: 130, density: 1 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let initialized = false;
    let petAnchor = null;
    let panelOrigin = null;
    let finishTransition = null;
    let hintTimer = 0;
    let offMessage = null;
    const menuReady = computed(() => expanded.value && !transitioning.value);
    const edgeClass = computed(() => edge.value ? `edge-${edge.value}` : "");
    const petClass = computed(() => ({
      dragging: dragging.value,
      landing: landing.value,
      happy: happy.value,
      thinking: petState.value === "thinking",
      working: petState.value === "working",
      feeding: petState.value === "feeding",
      success: petState.value === "success",
      error: petState.value === "error",
      sleep: petState.value === "sleep"
    }));
    watch(menuReady, (ready) => {
      document.body.classList.toggle("menu-ready", ready);
    });
    function applyWindowSize(width, height) {
      selfInfo.width = width;
      selfInfo.height = height;
      const scale = Math.min(width / 170, height / 190) * 0.95;
      const root = document.documentElement.style;
      root.setProperty("--pet-scale", String(scale));
      root.setProperty("--pet-width", `${width}px`);
      root.setProperty("--pet-height", `${height}px`);
    }
    function updateDragRegion() {
      return aicode.overlay.setDragRegion({
        left: 0,
        top: 0,
        width: selfInfo.width,
        height: selfInfo.height
      });
    }
    function postInteraction(type) {
      aicode.overlay.postMessage({ type }).catch(() => void 0);
    }
    function showHint(text) {
      hintText.value = text;
      hintVisible.value = true;
      clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => {
        hintVisible.value = false;
      }, HINT_VISIBLE_MS);
    }
    function setState(state) {
      var _a;
      petState.value = state;
      stateLabel.value = (_a = STATE_LABELS[state]) != null ? _a : "";
    }
    function setEdge(next) {
      edge.value = next;
    }
    function updatePosition(message) {
      if (expanded.value && panelOrigin && petAnchor) {
        petAnchor.x += message.x - panelOrigin.x;
        petAnchor.y += message.y - panelOrigin.y;
        panelOrigin = { x: message.x, y: message.y };
      } else if (!expanded.value) {
        petAnchor = { x: message.x, y: message.y };
      }
      selfInfo.x = message.x;
      selfInfo.y = message.y;
    }
    async function setExpanded(value) {
      if (!initialized || transitioning.value || expanded.value === value) return false;
      postInteraction("activity");
      const previous = expanded.value;
      transitioning.value = true;
      try {
        if (value) {
          const self = await aicode.overlay.self();
          petAnchor = { x: self.x, y: self.y };
        }
        expanded.value = value;
        await updateDragRegion();
        const completion = new Promise((resolve) => {
          finishTransition = resolve;
        });
        await aicode.overlay.resize(selfInfo.width, selfInfo.height + (value ? MENU_EXTRA_HEIGHT : 0), {
          animate: !reducedMotion,
          x: !value && petAnchor ? petAnchor.x : void 0,
          y: !value && petAnchor ? petAnchor.y : void 0
        });
        return await completion;
      } catch (e) {
        finishTransition == null ? void 0 : finishTransition(false);
        finishTransition = null;
        transitioning.value = false;
        expanded.value = previous;
        showHint("菜单调整失败");
        return false;
      }
    }
    function collapse() {
      void setExpanded(false);
    }
    async function runMenuAction(action) {
      if (!expanded.value || transitioning.value) return;
      if (await setExpanded(false)) {
        aicode.overlay.postMessage({ type: "menuAction", action }).catch(() => showHint("操作失败"));
      }
    }
    async function bounce() {
      happy.value = false;
      await nextTick();
      if (petEl.value) void petEl.value.offsetWidth;
      happy.value = true;
    }
    function onAnimationEnd(event) {
      if (event.target !== petEl.value) return;
      if (event.animationName === "hop") happy.value = false;
      if (event.animationName === "land") landing.value = false;
    }
    function handleMessage(message) {
      var _a, _b, _c, _d;
      if (!message || !message.type) return;
      const type = message.type;
      if (type === "click") {
        if (transitioning.value) return;
        if (expanded.value) {
          void setExpanded(false);
          return;
        }
        postInteraction("pet");
        if (petState.value === "sleep") return;
        void bounce();
        showHint((_a = CLICK_HINTS[Math.floor(Math.random() * CLICK_HINTS.length)]) != null ? _a : "喵");
        return;
      }
      if (type === "longPress") {
        void setExpanded(!expanded.value);
        return;
      }
      if (type === "hint") {
        showHint(String((_b = message.text) != null ? _b : ""));
        return;
      }
      if (type === "dragStart") {
        postInteraction("activity");
        setEdge(null);
        landing.value = false;
        happy.value = false;
        dragging.value = true;
        hintVisible.value = false;
        return;
      }
      if (type === "dragEnd") {
        postInteraction("activity");
        dragging.value = false;
        if (!reducedMotion) landing.value = true;
        updatePosition({ x: Number(message.x), y: Number(message.y) });
        return;
      }
      if (type === "snap") {
        const next = String((_c = message.edge) != null ? _c : "");
        if (next === "left" || next === "right" || next === "top" || next === "bottom") {
          setEdge(next);
          updatePosition({ x: Number(message.x), y: Number(message.y) });
        }
        return;
      }
      if (type === "resize") {
        const width = Number(message.width);
        const height = Number(message.height);
        const expected = width === selfInfo.width && height === selfInfo.height + (expanded.value ? MENU_EXTRA_HEIGHT : 0);
        transitioning.value = false;
        if (!expected) {
          expanded.value = false;
          applyWindowSize(width, height);
        }
        selfInfo.x = Number(message.x);
        selfInfo.y = Number(message.y);
        if (expanded.value) {
          panelOrigin = { x: selfInfo.x, y: selfInfo.y };
        } else {
          panelOrigin = null;
          petAnchor = { x: selfInfo.x, y: selfInfo.y };
        }
        updateDragRegion().catch(() => void 0);
        finishTransition == null ? void 0 : finishTransition(expected);
        finishTransition = null;
        return;
      }
      if (type === "state") {
        setState(String((_d = message.state) != null ? _d : "idle"));
      }
    }
    onMounted(async () => {
      offMessage = aicode.overlay.onMessage(handleMessage);
      try {
        const self = await aicode.overlay.self();
        selfInfo.x = self.x;
        selfInfo.y = self.y;
        selfInfo.density = self.density;
        petAnchor = { x: self.x, y: self.y };
        applyWindowSize(self.width, self.height);
        await updateDragRegion();
        initialized = true;
        postInteraction("petReady");
        showHint("拖动 / 长按");
      } catch (error) {
        console.error(error);
      }
    });
    onUnmounted(() => {
      offMessage == null ? void 0 : offMessage();
      clearTimeout(hintTimer);
      document.body.classList.remove("menu-ready");
    });
    return (_ctx, _cache) => {
      return openBlock(), createElementBlock("div", _hoisted_1, [
        createElementVNode(
          "div",
          {
            class: normalizeClass(["pet-wrap", edgeClass.value])
          },
          [
            createElementVNode("div", _hoisted_2, [
              createElementVNode("div", _hoisted_3, [
                createElementVNode(
                  "div",
                  {
                    ref_key: "petEl",
                    ref: petEl,
                    class: normalizeClass(["pet", petClass.value]),
                    onAnimationend: onAnimationEnd
                  },
                  [
                    _cache[3] || (_cache[3] = createStaticVNode('<div class="thought"><i></i><i></i><i></i></div><div class="tail"></div><div class="ear left"></div><div class="ear right"></div><div class="body"></div><div class="paw left"></div><div class="paw right"></div><div class="tool"></div><div class="face"><div class="eye left"></div><div class="eye right"></div><div class="muzzle"></div><div class="nose"></div><div class="cheek left"></div><div class="cheek right"></div></div><div class="food"></div>', 10)),
                    createElementVNode("div", {
                      class: "zzz",
                      hidden: petState.value !== "sleep",
                      "aria-hidden": petState.value !== "sleep"
                    }, "Z z", 8, _hoisted_4)
                  ],
                  34
                  /* CLASS, NEED_HYDRATION */
                )
              ])
            ])
          ],
          2
          /* CLASS */
        ),
        createElementVNode(
          "div",
          {
            class: normalizeClass(["hint", { show: hintVisible.value }])
          },
          toDisplayString(hintText.value),
          3
          /* TEXT, CLASS */
        ),
        createElementVNode(
          "div",
          {
            class: normalizeClass(["state-label", { show: !!stateLabel.value }])
          },
          toDisplayString(stateLabel.value),
          3
          /* TEXT, CLASS */
        ),
        createElementVNode("div", {
          class: "menu",
          "aria-hidden": !menuReady.value
        }, [
          createElementVNode("button", {
            class: "menu-close",
            "aria-label": "关闭菜单",
            title: "关闭",
            onClick: collapse
          }, "×"),
          createElementVNode("button", {
            disabled: !menuReady.value,
            onClick: _cache[0] || (_cache[0] = ($event) => runMenuAction("feed"))
          }, "喂食", 8, _hoisted_6),
          createElementVNode("button", {
            disabled: !menuReady.value,
            onClick: _cache[1] || (_cache[1] = ($event) => runMenuAction("sleep"))
          }, "休息", 8, _hoisted_7),
          createElementVNode("button", {
            disabled: !menuReady.value,
            onClick: _cache[2] || (_cache[2] = ($event) => runMenuAction("hide"))
          }, "隐藏", 8, _hoisted_8)
        ], 8, _hoisted_5)
      ]);
    };
  }
});
createApp(_sfc_main).mount("#app");
