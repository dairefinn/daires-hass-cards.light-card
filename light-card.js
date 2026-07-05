class LightCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._scenesPanelOpen = false;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    if (!config.entity && !config.entities) {
      throw new Error("You must define 'entity' or 'entities'");
    }
    this._config = config;
    this._render();
  }

  getCardSize() {
    return Math.max(2, this._getEntities().length + 1);
  }

  _getEntities() {
    const c = this._config;
    if (c.entities) return c.entities.map((e) => (typeof e === "string" ? { entity: e } : e));
    return [{ entity: c.entity, name: c.name }];
  }

  _getScenesConfig() {
    const s = this._config?.scenes;
    if (!s?.length) return [];
    return s.map((s) => (typeof s === "string" ? { entity: s } : s));
  }

  _getLightData(def) {
    const state = this._hass?.states[def.entity];
    const raw = state?.state ?? "unavailable";
    const isOn = raw === "on";
    const isUnavailable = raw === "unavailable" || raw === "unknown";

    const name =
      def.name ||
      state?.attributes?.friendly_name ||
      def.entity.split(".").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const brightness = state?.attributes?.brightness;
    const brightnessPercent = brightness != null ? Math.round((brightness / 255) * 100) : null;

    let label, color;
    if (isUnavailable) {
      label = "Unavailable";
      color = "var(--secondary-text-color, #727272)";
    } else if (isOn) {
      label = brightnessPercent != null ? `On · ${brightnessPercent}%` : "On";
      color = "var(--primary-color, #03a9f4)";
    } else {
      label = "Off";
      color = "var(--divider-color, #e0e0e0)";
    }

    return { name, label, color, isOn, isUnavailable, brightnessPercent, entityId: def.entity };
  }

  _getSceneData(def) {
    const state = this._hass?.states[def.entity];
    const name =
      def.name ||
      state?.attributes?.friendly_name ||
      def.entity.split(".").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, entityId: def.entity };
  }

  _bulbFillSvg(size, fillPercent) {
    const path = "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z";
    // Bulb content spans y=2–22 within the 24-unit viewBox; map fill to that range
    const contentTop = (2 / 24) * 100;
    const contentBottom = (22 / 24) * 100;
    const pct = Math.max(0, Math.min(100, fillPercent));
    const topPct = pct <= 0 ? 100 : (contentBottom - (pct / 100) * (contentBottom - contentTop)).toFixed(2);
    return `
      <div style="position:relative;display:inline-block;width:${size}px;height:${size}px;flex-shrink:0;">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24">
          <path d="${path}" style="fill:var(--divider-color,#e0e0e0);"/>
        </svg>
        <svg width="${size}" height="${size}" viewBox="0 0 24 24"
             style="position:absolute;inset:0;clip-path:polygon(0% ${topPct}%,100% ${topPct}%,100% 100%,0% 100%);">
          <path d="${path}" style="fill:var(--primary-color,#03a9f4);"/>
        </svg>
      </div>
    `;
  }

  _bulbSvg(size, color) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" style="transition:fill 0.6s ease;flex-shrink:0;">
      <path d="M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z"/>
    </svg>`;
  }

  _scenesIconSvg() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2"/>
      <circle cx="8" cy="10.5" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M3 18.5 L8 13 L11.5 16.5 L15 11.5 L21 18.5"/>
    </svg>`;
  }

  _primaryEntity() {
    const e = this._getEntities()[0];
    return (typeof e === "string" ? e : e?.entity) ?? null;
  }

  _handleInteraction(trigger, entityOverride) {
    const interaction = (this._config.interactions ?? []).find(
      (i) => (i.trigger ?? "tap") === trigger
    );
    if (!interaction) return;
    const { action } = interaction;
    if (action === "more-info") {
      const entityId = interaction.entity ?? entityOverride ?? this._primaryEntity();
      if (!entityId) return;
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      }));
    } else if (action === "toggle") {
      const entityId = interaction.entity ?? entityOverride ?? this._primaryEntity();
      if (!entityId || !this._hass) return;
      this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
    } else if (action === "call-service") {
      if (!interaction.service || !this._hass) return;
      const [domain, service] = interaction.service.split(".");
      this._hass.callService(domain, service, interaction.service_data ?? {});
    } else if (action === "navigate") {
      if (!interaction.path) return;
      try { window.history.pushState(null, "", interaction.path); } catch (_) {}
      this.dispatchEvent(new CustomEvent("location-changed", { bubbles: true, composed: true }));
    } else if (action === "url") {
      if (!interaction.url) return;
      window.open(interaction.url, interaction.target ?? "_blank");
    }
  }

  _attachTriggers(target, entityOverride) {
    const interactions = this._config?.interactions ?? [];
    const triggers = new Set(interactions.map((i) => i.trigger ?? "tap"));
    target.style.cursor = "pointer";

    if (triggers.has("tap") || triggers.has("double_tap")) {
      let tapCount = 0;
      let tapTimer = null;
      target.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        tapCount++;
        if (tapCount === 1) {
          tapTimer = setTimeout(() => {
            tapCount = 0;
            tapTimer = null;
            this._handleInteraction("tap", entityOverride);
          }, 250);
        } else {
          clearTimeout(tapTimer);
          tapTimer = null;
          tapCount = 0;
          this._handleInteraction("double_tap", entityOverride);
        }
      });
    }

    if (triggers.has("hold")) {
      let holdTimer;
      const startHold = () => { holdTimer = setTimeout(() => this._handleInteraction("hold", entityOverride), 500); };
      const cancelHold = () => clearTimeout(holdTimer);
      target.addEventListener("mousedown", startHold);
      target.addEventListener("mouseup", cancelHold);
      target.addEventListener("mouseleave", cancelHold);
      target.addEventListener("touchstart", startHold, { passive: true });
      target.addEventListener("touchend", cancelHold);
      target.addEventListener("touchcancel", cancelHold);
    }
  }

  _attachInteractionListeners() {
    const interactions = this._config?.interactions;
    if (!interactions?.length) return;

    const entities = this._getEntities();
    if (entities.length > 1) {
      this.shadowRoot.querySelectorAll(".row[data-entity]").forEach((row) => {
        row.classList.add("row-interactive");
        this._attachTriggers(row, row.dataset.entity);
      });
    }
  }

  _attachSceneListeners() {
    const toggle = this.shadowRoot.querySelector(".scenes-toggle");
    const panel = this.shadowRoot.querySelector(".scenes-panel");
    const close = this.shadowRoot.querySelector(".scenes-close");
    if (!toggle || !panel) return;

    const closePanel = () => {
      this._scenesPanelOpen = false;
      panel.classList.remove("open");
    };

    if (this._scenesPanelOpen) panel.classList.add("open");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this._scenesPanelOpen = true;
      panel.classList.add("open");
    });

    close?.addEventListener("click", closePanel);

    panel.querySelectorAll(".scene-item").forEach((item) => {
      item.addEventListener("click", () => {
        if (!this._hass) return;
        this._hass.callService("scene", "turn_on", { entity_id: item.dataset.entity });
        closePanel();
      });
    });
  }

  static getConfigElement() {
    return document.createElement("daires-hass-cards-light-card-editor");
  }

  static getStubConfig() {
    return { entities: [] };
  }

  _render() {
    if (!this._config) return;

    const config = this._config;
    const entities = this._getEntities();
    const lights = entities.map((e) => this._getLightData(e));
    const sceneDefs = this._getScenesConfig();
    const scenes = sceneDefs.map((d) => this._getSceneData(d));

    const background = config.background ?? "var(--card-background-color, #fff)";
    const isSingle = lights.length === 1;
    const onCount = lights.filter((l) => l.isOn).length;
    const steps = config.brightness_steps ?? Array.from({ length: 10 }, (_, i) => (i + 1) * 10);
    const maxStep = steps[steps.length - 1];
    const showState = config.show_state !== false;
    const showName = config.show_name !== false;
    const transparent = config.transparent === true;

    let innerContentHtml;

    if (isSingle) {
      const l = lights[0];
      const hasBrightness = l.isOn && l.brightnessPercent != null;
      const accentColor = l.isOn && !l.isUnavailable
        ? "var(--primary-color, #03a9f4)"
        : "var(--divider-color, #e0e0e0)";
      const displayPercent = l.isUnavailable ? 0 : l.isOn ? (l.brightnessPercent ?? 100) : 0;


      innerContentHtml = `
        <div class="bulb-bg">
          ${this._bulbFillSvg(96, displayPercent)}
        </div>
        <div class="card-content">
          ${showName ? `
          <div class="light-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;">
              <path d="M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z"/>
            </svg>
            ${l.name}
            ${showState ? `<span class="light-state" style="margin-left:auto;color:${l.color};">${l.label}</span>` : ""}
          </div>` : ""}
          <div class="flex-spacer"></div>
          ${!l.isUnavailable ? `
            <div class="controls-row">
              <div class="left-pad"></div>
              <div class="controls">
                <button class="ctrl-btn" id="dim-btn" ${!hasBrightness ? "disabled" : ""}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
                  </svg>
                </button>
                <button class="ctrl-btn toggle-btn" id="toggle-btn" style="background:${accentColor};transition:background 0.6s ease;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.89,6.89L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13V3Z"/>
                  </svg>
                </button>
                <button class="ctrl-btn" id="brighten-btn" ${l.isUnavailable || l.brightnessPercent >= maxStep ? "disabled" : ""}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                  </svg>
                </button>
              </div>
              ${scenes.length ? `
                <button class="scenes-toggle" type="button" title="Scenes">${this._scenesIconSvg()}</button>
              ` : `<div class="left-pad"></div>`}
            </div>
          ` : ""}
        </div>
      `;
    } else {
      const rows = lights
        .map(
          (l) => `
        <div class="row" data-entity="${l.entityId}">
          ${this._bulbSvg(24, l.color)}
          <div class="row-info">
            <div class="row-name">${l.name}</div>
            <div class="row-status" style="color:${l.color}">${l.label}</div>
          </div>
        </div>
      `
        )
        .join("");

      const showHeader = config.title || lights.length > 1;
      innerContentHtml = `
        ${showHeader ? `
          <div class="header">
            <div class="title">${config.title ?? ""}</div>
            ${lights.length > 1 ? `<div class="summary">${onCount} of ${lights.length} on</div>` : ""}
          </div>
        ` : ""}
        <div class="body-wrap">
          <div class="list">${rows}</div>
        </div>
      `;
    }

    const scenePanelHtml = scenes.length ? `
      <div class="scenes-panel">
        <div class="scenes-panel-header">
          <div class="scenes-panel-title">Scenes</div>
          <button class="scenes-close" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="scenes-list">
          ${scenes.map((s) => `
            <button class="scene-item" data-entity="${s.entityId}">${s.name}</button>
          `).join("")}
        </div>
      </div>
    ` : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        ha-card {
          display: block;
          height: 100%;
          ${transparent ? "background: transparent !important; box-shadow: none !important; border: none !important;" : ""}
        }
        .card {
          position: relative;
          background: ${transparent ? "transparent" : background};
          border-radius: 12px;
          padding: 16px;
          box-sizing: border-box;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
          flex-shrink: 0;
        }
        .title {
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color, #727272);
        }
        .summary {
          font-size: 13px;
          color: var(--secondary-text-color, #727272);
        }
        .scenes-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: none;
          color: var(--secondary-text-color, #727272);
          cursor: pointer;
          padding: 6px;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .scenes-toggle:hover {
          background: var(--divider-color, #e0e0e0);
          color: var(--primary-text-color, #212121);
        }
        .scenes-toggle.abs {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 2;
          border-radius: 6px;
          width: 28px;
          height: 28px;
          padding: 0;
        }
        .bulb-bg {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.25;
          z-index: 0;
        }
        .card-content {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .light-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color, #727272);
          transition: color 0.6s ease;
          cursor: pointer;
        }
        .light-header:hover {
          color: var(--primary-text-color, #212121);
        }
        .light-state {
          font-size: 13px;
          font-weight: 400;
          transition: color 0.6s ease;
          flex-shrink: 0;
        }
        .flex-spacer { flex: 1; }
        .controls-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 12px;
        }
        .left-pad { width: 32px; flex-shrink: 0; }
        .controls {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .ctrl-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-text-color, #212121);
          transition: background 0.2s;
        }
        .ctrl-btn:hover { background: var(--divider-color, #e0e0e0); }
        .ctrl-btn:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
        .toggle-btn {
          color: #fff;
        }
        .toggle-btn:hover { opacity: 0.85; background: none !important; }
        .body-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          border-radius: 8px;
        }
        .row-interactive {
          padding: 4px 8px;
          margin: -4px -8px;
          transition: background 0.15s;
        }
        .row-interactive:hover {
          background: var(--divider-color, #e0e0e0);
        }
        .row-info { flex: 1; min-width: 0; }
        .row-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color, #212121);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .row-status {
          font-size: 13px;
          margin-top: 2px;
          transition: color 0.6s ease;
        }
        .scenes-panel {
          position: absolute;
          inset: 0;
          background: ${background};
          border-radius: 12px;
          padding: 16px;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          z-index: 3;
        }
        .scenes-panel.open {
          opacity: 1;
          pointer-events: auto;
        }
        .scenes-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .scenes-panel-title {
          font-size: 14px;
          font-weight: 500;
          color: var(--secondary-text-color, #727272);
        }
        .scenes-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: none;
          color: var(--secondary-text-color, #727272);
          cursor: pointer;
          padding: 0;
          transition: background 0.15s, color 0.15s;
        }
        .scenes-close:hover {
          background: var(--divider-color, #e0e0e0);
          color: var(--primary-text-color, #212121);
        }
        .scenes-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
        }
        .scene-item {
          display: block;
          width: 100%;
          padding: 7px 8px;
          border: none;
          background: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 400;
          color: var(--primary-text-color, #212121);
          text-align: left;
          cursor: pointer;
          transition: background 0.15s;
        }
        .scene-item:hover {
          background: var(--divider-color, #e0e0e0);
        }
      </style>
      <ha-card>
        <div class="card">
          ${!isSingle && scenes.length ? `<button class="scenes-toggle abs" type="button" title="Scenes">${this._scenesIconSvg()}</button>` : ""}
          ${innerContentHtml}
          ${scenePanelHtml}
        </div>
      </ha-card>
    `;

    if (isSingle) {
      const entityId = lights[0].entityId;
      this.shadowRoot.querySelector(".light-header")?.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          detail: { entityId },
          bubbles: true,
          composed: true,
        }));
      });
    }

    if (isSingle && !lights[0].isUnavailable) {
      const entityId = lights[0].entityId;
      this.shadowRoot.getElementById("toggle-btn")?.addEventListener("click", () => {
        this._hass?.callService("homeassistant", "toggle", { entity_id: entityId });
      });
      this.shadowRoot.getElementById("dim-btn")?.addEventListener("click", () => {
        const current = lights[0].brightnessPercent ?? 0;
        const prev = [...steps].reverse().find(s => s < current);
        if (prev != null) {
          this._hass?.callService("light", "turn_on", { entity_id: entityId, brightness_pct: prev });
        } else {
          this._hass?.callService("light", "turn_off", { entity_id: entityId });
        }
      });
      this.shadowRoot.getElementById("brighten-btn")?.addEventListener("click", () => {
        const current = lights[0].isOn ? (lights[0].brightnessPercent ?? 0) : 0;
        const next = steps.find(s => s > current) ?? steps[steps.length - 1];
        this._hass?.callService("light", "turn_on", { entity_id: entityId, brightness_pct: next });
      });
    }

    this._attachInteractionListeners();
    this._attachSceneListeners();
  }
}

customElements.define("daires-hass-cards-light-card", LightCard);

class LightCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    this._hass = hass;
    this.shadowRoot.querySelectorAll("ha-entity-picker").forEach((p) => { p.hass = hass; });
  }

  setConfig(config) {
    const c = { ...config };
    if (c.entity !== undefined && !c.entities) {
      c.entities = [{ entity: c.entity, ...(c.name ? { name: c.name } : {}) }];
      delete c.entity;
      delete c.name;
    } else if (!c.entities) {
      c.entities = [];
    }
    if (!c.scenes) c.scenes = [];
    this._config = c;
    this._render();
  }

  _fire() {
    const config = { ...this._config };
    if (!config.scenes?.length) delete config.scenes;
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  _setField(key, value) {
    if (value === "" || value === undefined) {
      delete this._config[key];
    } else {
      this._config[key] = value;
    }
    this._fire();
  }

  _updateEntity(i, field, value) {
    const entities = this._config.entities.map((e) => ({ ...e }));
    if (value) {
      entities[i][field] = value;
    } else {
      delete entities[i][field];
    }
    this._config = { ...this._config, entities };
    this._fire();
  }

  _addEntity() {
    this._config = { ...this._config, entities: [...this._config.entities, { entity: "" }] };
    this._renderList();
    this._fire();
  }

  _removeEntity(i) {
    const entities = this._config.entities.filter((_, idx) => idx !== i);
    this._config = { ...this._config, entities };
    this._renderList();
    this._fire();
  }

  _updateScene(i, field, value) {
    const scenes = this._config.scenes.map((s) => ({ ...s }));
    if (value) {
      scenes[i][field] = value;
    } else {
      delete scenes[i][field];
    }
    this._config = { ...this._config, scenes };
    this._fire();
  }

  _addScene() {
    this._config = { ...this._config, scenes: [...this._config.scenes, { entity: "" }] };
    this._renderSceneList();
    this._fire();
  }

  _removeScene(i) {
    const scenes = this._config.scenes.filter((_, idx) => idx !== i);
    this._config = { ...this._config, scenes };
    this._renderSceneList();
    this._fire();
  }

  _renderList() {
    const entities = this._config.entities ?? [];
    const list = this.shadowRoot.getElementById("entities-list");
    if (!list) return;

    list.innerHTML = entities.map((e, i) => `
      <div class="entity-row">
        <div class="picker-wrap"><ha-entity-picker data-index="${i}" data-type="entity"></ha-entity-picker></div>
        <input class="name-input" type="text" data-index="${i}" data-type="entity" placeholder="Name (optional)" />
        <button class="remove-btn" data-index="${i}" data-type="entity" type="button">✕</button>
      </div>
    `).join("");

    list.querySelectorAll("ha-entity-picker").forEach((picker) => {
      const i = parseInt(picker.dataset.index);
      picker.value = entities[i]?.entity ?? "";
      picker.includeDomains = ["light"];
      if (this._hass) picker.hass = this._hass;
      picker.addEventListener("value-changed", (e) => this._updateEntity(i, "entity", e.detail.value));
    });

    list.querySelectorAll(".name-input[data-type=entity]").forEach((input) => {
      const i = parseInt(input.dataset.index);
      input.value = entities[i]?.name ?? "";
      input.addEventListener("change", (e) => this._updateEntity(i, "name", e.target.value));
    });

    list.querySelectorAll(".remove-btn[data-type=entity]").forEach((btn) => {
      const i = parseInt(btn.dataset.index);
      btn.addEventListener("click", () => this._removeEntity(i));
    });
  }

  _renderSceneList() {
    const scenes = this._config.scenes ?? [];
    const list = this.shadowRoot.getElementById("scenes-list");
    if (!list) return;

    list.innerHTML = scenes.map((s, i) => `
      <div class="entity-row">
        <div class="picker-wrap"><ha-entity-picker data-index="${i}" data-type="scene"></ha-entity-picker></div>
        <input class="name-input" type="text" data-index="${i}" data-type="scene" placeholder="Name (optional)" />
        <button class="remove-btn" data-index="${i}" data-type="scene" type="button">✕</button>
      </div>
    `).join("");

    list.querySelectorAll("ha-entity-picker").forEach((picker) => {
      const i = parseInt(picker.dataset.index);
      picker.value = scenes[i]?.entity ?? "";
      picker.includeDomains = ["scene"];
      if (this._hass) picker.hass = this._hass;
      picker.addEventListener("value-changed", (e) => this._updateScene(i, "entity", e.detail.value));
    });

    list.querySelectorAll(".name-input[data-type=scene]").forEach((input) => {
      const i = parseInt(input.dataset.index);
      input.value = scenes[i]?.name ?? "";
      input.addEventListener("change", (e) => this._updateScene(i, "name", e.target.value));
    });

    list.querySelectorAll(".remove-btn[data-type=scene]").forEach((btn) => {
      const i = parseInt(btn.dataset.index);
      btn.addEventListener("click", () => this._removeScene(i));
    });
  }

  _render() {
    const c = this._config ?? {};
    this.shadowRoot.innerHTML = `
      <style>
        .form { display: flex; flex-direction: column; gap: 12px; padding: 16px 0; }
        .section { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--secondary-text-color, #727272); padding-bottom: 4px; border-bottom: 1px solid var(--divider-color, #e0e0e0); margin-top: 8px; }
        .row { display: flex; flex-direction: column; gap: 4px; }
        label { font-size: 12px; color: var(--secondary-text-color, #727272); }
        input[type=text] { padding: 8px 10px; border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px; font-size: 14px; color: var(--primary-text-color, #212121); background: var(--card-background-color, #fff); box-sizing: border-box; width: 100%; }
        ha-entity-picker { display: block; }
        .entity-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .picker-wrap { flex: 2; min-width: 0; }
        .name-input { flex: 1; min-width: 0; }
        .remove-btn { background: none; border: none; cursor: pointer; color: var(--secondary-text-color, #727272); font-size: 18px; padding: 4px 8px; border-radius: 4px; flex-shrink: 0; line-height: 1; }
        .remove-btn:hover { background: var(--divider-color, #e0e0e0); }
        .add-btn { display: flex; align-items: center; justify-content: center; background: none; border: 1px dashed var(--divider-color, #e0e0e0); border-radius: 6px; padding: 10px; cursor: pointer; font-size: 13px; color: var(--primary-color, #03a9f4); width: 100%; box-sizing: border-box; }
        .add-btn:hover { background: var(--divider-color, #e0e0e0); }
        .check-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--primary-text-color, #212121); cursor: pointer; }
      </style>
      <div class="form">
        <div class="section">Lights</div>
        <div id="entities-list"></div>
        <button class="add-btn" id="add-entity-btn" type="button">+ Add light</button>

        <div class="section">Scenes</div>
        <div id="scenes-list"></div>
        <button class="add-btn" id="add-scene-btn" type="button">+ Add scene</button>

        <div class="section">Display</div>
        <div class="row"><label>Title</label><input id="title" type="text" placeholder="Lights" /></div>
        <div class="row"><label>Brightness steps</label><input id="brightness-steps" type="text" placeholder="10, 20, 30, … 100" /></div>
        <label class="check-label"><input type="checkbox" id="show-name" /> Show entity name</label>
        <label class="check-label"><input type="checkbox" id="show-state" /> Show state in header</label>
        <label class="check-label"><input type="checkbox" id="transparent" /> Transparent background</label>
      </div>
    `;

    this._renderList();
    this._renderSceneList();

    const titleEl = this.shadowRoot.getElementById("title");
    titleEl.value = c.title ?? "";
    titleEl.addEventListener("change", (e) => this._setField("title", e.target.value));

    const stepsEl = this.shadowRoot.getElementById("brightness-steps");
    stepsEl.value = c.brightness_steps ? c.brightness_steps.join(", ") : "";
    stepsEl.addEventListener("change", (e) => {
      const raw = e.target.value.trim();
      if (!raw) {
        this._setField("brightness_steps", undefined);
      } else {
        const parsed = raw.split(/[\s,]+/).map(Number).filter(n => !isNaN(n) && n > 0 && n <= 100);
        if (parsed.length) this._setField("brightness_steps", parsed);
      }
    });

    const showNameEl = this.shadowRoot.getElementById("show-name");
    showNameEl.checked = c.show_name !== false;
    showNameEl.addEventListener("change", (e) => {
      this._setField("show_name", e.target.checked ? undefined : false);
    });

    const showStateEl = this.shadowRoot.getElementById("show-state");
    showStateEl.checked = c.show_state !== false;
    showStateEl.addEventListener("change", (e) => {
      this._setField("show_state", e.target.checked ? undefined : false);
    });

    const transparentEl = this.shadowRoot.getElementById("transparent");
    transparentEl.checked = c.transparent === true;
    transparentEl.addEventListener("change", (e) => {
      this._setField("transparent", e.target.checked ? true : undefined);
    });

    this.shadowRoot.getElementById("add-entity-btn").addEventListener("click", () => this._addEntity());
    this.shadowRoot.getElementById("add-scene-btn").addEventListener("click", () => this._addScene());
  }
}

customElements.define("daires-hass-cards-light-card-editor", LightCardEditor);
