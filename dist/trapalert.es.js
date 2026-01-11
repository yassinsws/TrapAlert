class StruggleScore {
  constructor(decayRate = 2) {
    this.score = 0;
    this.lastDecayTime = Date.now();
    this.decayRate = decayRate;
  }
  setDecayRate(rate) {
    this.decayRate = rate;
  }
  add(points) {
    this.score = this.score + points;
    return this.score;
  }
  subtract(points) {
    this.score = Math.max(0, this.score - points);
    return this.score;
  }
  decay() {
    const now = Date.now();
    const elapsed = (now - this.lastDecayTime) / 1e3;
    if (elapsed >= 1) {
      const decayAmount = elapsed * this.decayRate;
      this.subtract(decayAmount);
      this.lastDecayTime = now;
    }
  }
  get() {
    return this.score;
  }
  reset() {
    this.score = 0;
    this.lastDecayTime = Date.now();
  }
}
class NotificationSystem {
  constructor(shadowRoot, onReport, onDismiss) {
    this.shadowRoot = shadowRoot;
    this.onReport = onReport;
    this.onDismiss = onDismiss;
    this.ariaLiveRegion = null;
    this.initialize();
  }
  initialize() {
    this.createAriaLiveRegion();
    this.createSidebar();
  }
  createAriaLiveRegion() {
    this.ariaLiveRegion = document.createElement("div");
    this.ariaLiveRegion.setAttribute("role", "status");
    this.ariaLiveRegion.setAttribute("aria-live", "assertive");
    this.ariaLiveRegion.setAttribute("aria-atomic", "true");
    this.ariaLiveRegion.style.cssText = `
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    `;
    this.shadowRoot.appendChild(this.ariaLiveRegion);
  }
  createSidebar() {
    const style = document.createElement("style");
    style.textContent = `
      .trapalert-sidebar {
        position: fixed;
        top: 0;
        right: -400px;
        width: 350px;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
        transition: right 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        z-index: 999999;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        display: flex;
        flex-direction: column;
        padding: 30px 25px;
        box-sizing: border-box;
      }

      .trapalert-sidebar.visible {
        right: 0;
      }

      .trapalert-header {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .trapalert-icon {
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }

      .trapalert-message {
        font-size: 16px;
        line-height: 1.6;
        margin-bottom: 25px;
        opacity: 0.95;
      }

      .trapalert-score {
        background: rgba(255, 255, 255, 0.15);
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 20px;
        backdrop-filter: blur(10px);
      }

      .trapalert-score-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        opacity: 0.8;
        margin-bottom: 5px;
      }

      .trapalert-score-value {
        font-size: 36px;
        font-weight: 700;
      }

      .trapalert-button {
        background: white;
        color: #667eea;
        border: none;
        padding: 14px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 10px;
      }

      .trapalert-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .trapalert-button:active {
        transform: translateY(0);
      }

      .trapalert-button-secondary {
        background: transparent;
        color: white;
        border: 2px solid rgba(255, 255, 255, 0.3);
      }

      .trapalert-close {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .trapalert-close:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    `;
    this.shadowRoot.appendChild(style);
    const sidebar = document.createElement("div");
    sidebar.className = "trapalert-sidebar";
    sidebar.innerHTML = `
      <button class="trapalert-close" aria-label="Close notification">×</button>
      <div class="trapalert-header">
        <div class="trapalert-icon">⚠️</div>
        <span>TrapAlert</span>
      </div>
      <div class="trapalert-message">
        We've detected potential accessibility barriers on this page. Your feedback helps make the web better for everyone.
      </div>
      <div class="trapalert-score">
        <div class="trapalert-score-label">Frustration Score</div>
        <div class="trapalert-score-value" id="score-display">0</div>
      </div>
      <button class="trapalert-button" id="report-btn">
        Report Accessibility Issue
      </button>
      <button class="trapalert-button trapalert-button-secondary" id="dismiss-btn">
        Dismiss
      </button>
    `;
    this.shadowRoot.appendChild(sidebar);
    this.bindEvents();
  }
  bindEvents() {
    const closeBtn = this.shadowRoot.querySelector(".trapalert-close");
    const reportBtn = this.shadowRoot.querySelector("#report-btn");
    const dismissBtn = this.shadowRoot.querySelector("#dismiss-btn");
    closeBtn.addEventListener("click", () => this.hide());
    dismissBtn.addEventListener("click", () => {
      this.hide();
      this.onDismiss();
    });
    reportBtn.addEventListener("click", () => {
      this.onReport();
      this.updateMessage("Thank you for reporting. Your feedback helps improve accessibility.");
    });
  }
  show(score) {
    const sidebar = this.shadowRoot.querySelector(".trapalert-sidebar");
    if (sidebar) {
      this.updateScore(score);
      sidebar.classList.add("visible");
      this.playNotificationSound();
      this.announce("TrapAlert: Accessibility barrier detected. Press Alt+T to report.");
    }
  }
  hide() {
    const sidebar = this.shadowRoot.querySelector(".trapalert-sidebar");
    if (sidebar) {
      sidebar.classList.remove("visible");
    }
  }
  updateScore(score) {
    const scoreDisplay = this.shadowRoot.querySelector("#score-display");
    if (scoreDisplay) {
      scoreDisplay.textContent = Math.round(score);
    }
  }
  announce(message) {
    if (this.ariaLiveRegion) {
      this.ariaLiveRegion.textContent = message;
    }
  }
  updateMessage(message) {
    this.announce(message);
    const messageEl = this.shadowRoot.querySelector(".trapalert-message");
    if (messageEl) {
      messageEl.textContent = message;
    }
  }
  playNotificationSound() {
    const audioData = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==";
    try {
      const audio = new Audio(audioData);
      audio.volume = 0.3;
      audio.play().catch((err) => {
        console.warn("[TrapAlert] Could not play notification sound:", err);
      });
    } catch (err) {
      console.warn("[TrapAlert] Audio not supported:", err);
    }
  }
}
function getElementSelector(element) {
  if (!element || element === document) return "document";
  if (element === window) return "window";
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.className && typeof element.className === "string") {
    const classes = element.className.trim().split(/\s+/).join(".");
    if (classes) {
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
  }
  return element.tagName.toLowerCase();
}
function hasPointerCursor(element) {
  try {
    const style = window.getComputedStyle(element);
    return style.cursor === "pointer";
  } catch (e) {
    return false;
  }
}
function getElementXPath(element) {
  if (element.id !== "") return `//*[@id="${element.id}"]`;
  if (element === document.body) return "/html/body";
  let ix = 0;
  const siblings = element.parentNode ? element.parentNode.childNodes : [];
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) {
      return getElementXPath(element.parentNode) + "/" + element.tagName.toLowerCase() + "[" + (ix + 1) + "]";
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
  return "";
}
class BehaviorEngine {
  constructor(struggleScore) {
    this.struggleScore = struggleScore;
    this.focusBuffer = [];
    this.maxFocusBuffer = 20;
    this.navigationHistory = [];
    this.maxNavHistory = 10;
    this.clickHistory = /* @__PURE__ */ new Map();
    this.tabCount = 0;
    this.lastProductiveAction = Date.now();
    this.currentInputObj = null;
    this.momentumEndsAt = 0;
    this.sensitivityMultiplier = 1;
    this.sensitivityEndsAt = 0;
    this.interactedElements = /* @__PURE__ */ new Set();
    this.focusClusterBuffer = [];
  }
  /**
   * Helper to add score with momentum and sensitivity applied
   */
  addScore(points, reason) {
    const now = Date.now();
    let finalPoints = points;
    if (this.onTrigger) this.onTrigger();
    if (now < this.sensitivityEndsAt) {
      finalPoints *= this.sensitivityMultiplier;
    }
    const isFrustrationMarker = points >= 60 || reason === "Rage Click";
    if (now < this.momentumEndsAt && !isFrustrationMarker) {
      finalPoints *= 0.2;
    }
    finalPoints = Math.round(finalPoints);
    if (finalPoints > 0) {
      console.log(`[BehaviorEngine] Adding ${finalPoints} points (${reason}). Base: ${points}, Sens: ${this.sensitivityMultiplier}, Mom: ${now < this.momentumEndsAt}`);
      this.struggleScore.add(finalPoints);
    }
  }
  /**
   * Register a successful action (typing, clicking, navigating)
   */
  registerSuccess() {
    this.momentumEndsAt = Date.now() + 5e3;
    this.resetDeadEndTab();
    this.uTurnCounter = 0;
    this.struggleScore.setDecayRate(10);
    this.struggleScore.subtract(10);
    if (this.decayRevertTimeout) clearTimeout(this.decayRevertTimeout);
    this.decayRevertTimeout = setTimeout(() => {
      this.struggleScore.setDecayRate(2);
    }, 5e3);
  }
  /**
   * Register a high-risk context shift (error message, submit click)
   */
  registerContextShift(isSubmit = false) {
    this.momentumEndsAt = 0;
    this.uTurnCounter = 0;
    this.sensitivityMultiplier = 2;
    this.sensitivityEndsAt = Date.now() + 3e4;
    console.log(`[BehaviorEngine] Context Shift! Sensitivity doubled. Submit: ${isSubmit}`);
  }
  /**
   * Process focusin events for Efficiency Ratio & U-Turn
   */
  handleFocus(element) {
    const selector = getElementSelector(element);
    const xpath = getElementXPath(element);
    const id = element.id || null;
    const now = Date.now();
    this.pruneHistory(now);
    if (this.interactedElements.has(selector)) {
      return;
    }
    this.focusBuffer.push({ id, xpath, timestamp: now });
    if (this.focusBuffer.length > this.maxFocusBuffer) {
      this.focusBuffer.shift();
    }
    const rect = element.getBoundingClientRect();
    this.focusClusterBuffer.push({
      x: rect.left,
      y: rect.top,
      selector,
      timestamp: now
    });
    if (this.focusClusterBuffer.length > 5) this.focusClusterBuffer.shift();
    this.detectClusterLoop();
    this.evaluateEfficiency();
    this.navigationHistory.push(selector);
    if (this.navigationHistory.length > this.maxNavHistory) {
      this.navigationHistory.shift();
    }
    this.detectUTurn();
  }
  pruneHistory(now) {
    const threshold = 6e4;
    this.focusBuffer = this.focusBuffer.filter((item) => now - item.timestamp < threshold);
    this.focusClusterBuffer = this.focusClusterBuffer.filter((item) => now - item.timestamp < threshold);
  }
  detectClusterLoop() {
    if (this.focusClusterBuffer.length < 5) return;
    const xs = this.focusClusterBuffer.map((p) => p.x);
    const ys = this.focusClusterBuffer.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;
    if (width < 300 && height < 300) {
      const selectors = this.focusClusterBuffer.map((p) => p.selector);
      const uniqueInCluster = new Set(selectors).size;
      if (uniqueInCluster < 3) {
        console.log("[BehaviorEngine] Localized Trap (Cluster) detected");
        this.addScore(10, "Localized Trap");
      }
    }
  }
  /**
   * "Efficiency Ratio" Logic
   */
  evaluateEfficiency() {
    const totalEvents = this.focusBuffer.length;
    if (totalEvents < 8) return;
    const uniqueKeys = new Set(this.focusBuffer.map((item) => item.id || item.xpath));
    const uniqueCount = uniqueKeys.size;
    const efficiency = uniqueCount / totalEvents;
    if (efficiency < 0.25) {
      this.addScore(5, "Low Efficiency");
    } else if (efficiency > 0.8) {
      this.resetDeadEndTab();
      if (this.struggleScore.get() > 0) {
        this.struggleScore.subtract(20);
      }
    }
  }
  /**
   * "The U-Turn" Logic
   * A -> B -> C -> B -> A
   */
  detectUTurn() {
    if (this.navigationHistory.length < 5) return;
    const h = this.navigationHistory;
    const len = h.length;
    const A1 = h[len - 5];
    const B1 = h[len - 4];
    const C = h[len - 3];
    const B2 = h[len - 2];
    const A2 = h[len - 1];
    if (A1 === A2 && B1 === B2 && A1 !== B1 && B1 !== C) {
      this.uTurnCounter = (this.uTurnCounter || 0) + 1;
      if (this.uTurnCounter > 1) {
        console.log("[BehaviorEngine] Repeated U-Turn detected");
        this.addScore(20, "Repeated U-Turn");
      } else {
        console.log("[BehaviorEngine] Intentional U-Turn (Normalization)");
        this.addScore(5, "Minor Backtrack");
      }
      this.navigationHistory = [];
    }
  }
  /**
   * "Rage Clicking" Logic
   */
  handleClick(element) {
    const selector = getElementSelector(element);
    const now = Date.now();
    const hasPointer = hasPointerCursor(element);
    const likelyInteractive = ["a", "button", "input", "select", "textarea"].includes(element.tagName.toLowerCase()) || element.hasAttribute("onclick") || element.getAttribute("role") === "button";
    if (likelyInteractive || hasPointer) {
      this.pendingSuccess = {
        timestamp: now,
        type: "click",
        selector
      };
      setTimeout(() => {
        if (this.pendingSuccess && this.pendingSuccess.timestamp === now) {
          this.pendingSuccess = null;
        }
      }, 1e3);
    }
    if (["input", "textarea", "select"].includes(element.tagName.toLowerCase())) {
      this.interactedElements.add(selector);
    }
    if (element.getAttribute("type") === "submit" || element.getAttribute("role") === "button") {
      this.registerContextShift(true);
    }
    if (!this.clickHistory.has(selector)) {
      this.clickHistory.set(selector, []);
    }
    const clicks = this.clickHistory.get(selector);
    clicks.push(now);
    const recentClicks = clicks.filter((t) => now - t < 2e3);
    this.clickHistory.set(selector, recentClicks);
    if (recentClicks.length > 5) {
      if (!hasPointer && !likelyInteractive) {
        this.addScore(60, "Rage Click (Static)");
        this.clickHistory.delete(selector);
      } else {
        console.log("[BehaviorEngine] Potential Broken Button / Dead-End Click sequence");
        this.addScore(40, "Button Mashing");
        this.clickHistory.delete(selector);
      }
    }
  }
  /**
   * Called by TrapAlert when a DOM mutation is detected
   */
  registerMutation() {
    if (this.pendingSuccess) {
      console.log(`[BehaviorEngine] Click on ${this.pendingSuccess.selector} verified by DOM mutation. Registering Success.`);
      this.registerSuccess();
      this.pendingSuccess = null;
    }
  }
  /**
   * "The Dead-End Tab"
   * >15 tabs without a single change (or while stuck).
   * If handled in handleFocus via efficiency resets, this just catches
   * pure rapid tabbing without focus change (rare) OR low-efficiency tabbing.
   */
  handleTab() {
    this.tabCount++;
    if (this.tabCount > 15) {
      this.addScore(40, "Dead-End Tab");
      this.tabCount = 0;
    }
  }
  resetDeadEndTab() {
    this.tabCount = 0;
  }
  /**
   * "Input Abandonment"
   * User clicks an input, types <3 chars, deletes them, and tabs away.
   */
  handleInputFocus(element) {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      this.currentInputObj = {
        element,
        startValue: element.value,
        maxLenReached: element.value.length,
        typed: false
      };
    }
  }
  handleInputType(element) {
    this.registerSuccess();
    if (this.currentInputObj && this.currentInputObj.element === element) {
      this.currentInputObj.typed = true;
      this.interactedElements.add(getElementSelector(element));
      if (element.value.length > this.currentInputObj.maxLenReached) {
        this.currentInputObj.maxLenReached = element.value.length;
      }
    }
  }
  handleInputBlur(element) {
    if (this.currentInputObj && this.currentInputObj.element === element) {
      const finalLen = element.value.length;
      const startLen = this.currentInputObj.startValue.length;
      const charsAdded = this.currentInputObj.maxLenReached - startLen;
      const wasEdited = this.currentInputObj.typed;
      const reverted = finalLen <= startLen;
      const smallEffort = charsAdded > 0 && charsAdded < 3;
      if (wasEdited && smallEffort && reverted) {
        this.addScore(20, "Input Abandonment");
      }
      this.currentInputObj = null;
    }
  }
}
class TrapAlert {
  constructor(config) {
    if (!config || !config.tenantId || !config.collectorEndpoint) {
      throw new Error("TrapAlert requires tenantId and collectorEndpoint");
    }
    this.tenantId = config.tenantId;
    this.collectorEndpoint = config.collectorEndpoint;
    this.struggleScore = new StruggleScore();
    this.behavioralTrace = [];
    this.maxTraceLength = 20;
    this.behaviorEngine = new BehaviorEngine(this.struggleScore);
    this.behaviorEngine.onTrigger = () => {
      this.lastTriggerTime = Date.now();
    };
    this.focusHistory = [];
    this.escPressHistory = [];
    this.lastProductiveTime = Date.now();
    this.startTime = Date.now();
    this.lastTriggerTime = Date.now();
    this.activationThreshold = 100;
    this.triggerLevel = 0;
    this.notificationShown = false;
    this.ui = null;
    this.init();
  }
  init() {
    this.setupUI();
    this.attachListeners();
    this.startDecayTimer();
    this.startVelocityGateMonitor();
    console.log(`[TrapAlert] Initialized for tenant: ${this.tenantId}`);
  }
  startVelocityGateMonitor() {
    setInterval(() => {
      const now = Date.now();
      const timeSinceStart = now - this.startTime;
      const timeSinceLastTrigger = now - this.lastTriggerTime;
      if (timeSinceStart > 6e5 && timeSinceLastTrigger > 6e5) {
        if (this.activationThreshold === 100) {
          this.activationThreshold = 120;
          console.log("[TrapAlert] Velocity Gate: Increasing threshold to 120 for happy user.");
        }
      }
    }, 6e4);
  }
  setupUI() {
    const container = document.createElement("div");
    container.id = "trapalert-container";
    container.setAttribute("aria-hidden", "false");
    document.body.appendChild(container);
    const shadowRoot = container.attachShadow({ mode: "open" });
    this.ui = new NotificationSystem(
      shadowRoot,
      () => this.handleReport(),
      () => this.handleDismiss()
    );
  }
  attachListeners() {
    window.addEventListener("focusin", this.handleFocusIn.bind(this), true);
    window.addEventListener("focusout", this.handleFocusOut.bind(this), true);
    window.addEventListener("keydown", this.handleKeyDown.bind(this), true);
    window.addEventListener("click", this.handleClick.bind(this), true);
    window.addEventListener("input", this.handleInput.bind(this), true);
    window.addEventListener("keydown", this.handleShortcut.bind(this), true);
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-live", "class", "style"]
    });
    window.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        console.log("[TrapAlert] Tab hidden - resetting frustration engine");
        this.struggleScore.reset();
        this.triggerLevel = 0;
        this.behaviorEngine.resetDeadEndTab();
      }
    });
  }
  handleMutations(mutations) {
    if (mutations.length > 0) {
      this.behaviorEngine.registerMutation();
    }
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            this.checkErrorNode(node);
          }
        });
      } else if (mutation.type === "attributes") {
        this.checkErrorNode(mutation.target);
      }
    }
  }
  checkErrorNode(node) {
    if (!node.getAttribute) return;
    const role = node.getAttribute("role");
    const ariaLive = node.getAttribute("aria-live");
    const isError = role === "alert" || ariaLive === "assertive" || node.className && typeof node.className === "string" && node.className.toLowerCase().includes("error");
    if (isError) {
      console.log("[TrapAlert] Error message detected (DOM Mutation)");
      this.behaviorEngine.registerContextShift(false);
    }
  }
  handleFocusIn(event) {
    const target = event.target;
    const selector = getElementSelector(target);
    const now = Date.now();
    this.addToTrace("focusin", selector);
    this.focusHistory.push({
      element: target,
      selector,
      timestamp: now
    });
    this.focusHistory = this.focusHistory.filter((h) => now - h.timestamp < 6e4);
    if (this.focusHistory.length > 20) {
      this.focusHistory.shift();
    }
    this.behaviorEngine.handleFocus(target);
    this.behaviorEngine.handleInputFocus(target);
    this.checkThreshold();
  }
  handleFocusOut(event) {
    this.behaviorEngine.handleInputBlur(event.target);
    this.checkThreshold();
  }
  handleKeyDown(event) {
    this.addToTrace("keydown", event.key);
    if (event.key === "Tab") {
      this.behaviorEngine.handleTab();
      this.checkThreshold();
    }
    if (event.key === "Escape") {
      this.handleEscapePress();
    }
  }
  handleEscapePress() {
    const now = Date.now();
    this.escPressHistory.push(now);
    this.escPressHistory = this.escPressHistory.filter((t) => now - t < 3e3);
    if (this.escPressHistory.length >= 3) {
      console.log("[TrapAlert] Rapid Escape presses detected");
      this.struggleScore.add(50);
      this.checkThreshold();
      this.escPressHistory = [];
    }
  }
  handleClick(event) {
    const target = event.target;
    const selector = getElementSelector(target);
    this.addToTrace("click", selector);
    this.markProductiveBehavior();
    this.behaviorEngine.handleClick(target);
    this.checkThreshold();
  }
  handleInput(event) {
    this.addToTrace("input", getElementSelector(event.target));
    this.markProductiveBehavior();
    this.behaviorEngine.handleInputType(event.target);
  }
  markProductiveBehavior() {
    this.lastProductiveTime = Date.now();
    this.behaviorEngine.resetDeadEndTab();
  }
  handleShortcut(event) {
    if (event.altKey && event.key === "t") {
      event.preventDefault();
      this.ui.show(this.struggleScore.get());
    }
  }
  startDecayTimer() {
    setInterval(() => {
      this.struggleScore.decay();
      if (this.notificationShown) {
        this.ui.updateScore(this.struggleScore.get());
      }
    }, 1e3);
  }
  addToTrace(type, detail) {
    this.behavioralTrace.push({
      type,
      detail,
      timestamp: Date.now(),
      url: window.location.href
    });
    if (this.behavioralTrace.length > this.maxTraceLength) {
      this.behavioralTrace.shift();
    }
  }
  checkThreshold() {
    const score = this.struggleScore.get();
    const firstLimit = this.activationThreshold;
    const secondLimit = firstLimit * 2;
    if (this.triggerLevel === 0 && score >= firstLimit) {
      console.log(`[TrapAlert] Level 1 Trigger (Score: ${score}, Threshold: ${firstLimit})`);
      this.triggerLevel = 1;
      this.notifyUser();
    } else if (this.triggerLevel === 1 && score >= secondLimit) {
      console.log(`[TrapAlert] Level 2 Escalation (Score: ${score}, Threshold: ${secondLimit})`);
      this.triggerLevel = 2;
      this.notifyUser();
    }
    if (score < 10 && this.triggerLevel !== 0) {
      this.triggerLevel = 0;
    }
  }
  notifyUser() {
    if (this.notificationShown) return;
    this.notificationShown = true;
    this.ui.show(this.struggleScore.get());
  }
  handleDismiss() {
    this.notificationShown = false;
  }
  handleReport() {
    this.dispatchReport();
    this.notificationShown = false;
    this.struggleScore.reset();
    this.triggerLevel = 0;
  }
  dispatchReport() {
    const payload = {
      tenantId: this.tenantId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      url: window.location.href,
      struggleScore: this.struggleScore.get(),
      behavioralTrace: this.behavioralTrace,
      context: this.captureContext(),
      metadata: this.getBrowserMetadata()
    };
    console.log("[TrapAlert] Dispatching report:", payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const sent = navigator.sendBeacon(this.collectorEndpoint, blob);
      if (!sent) {
        this.fallbackFetch(payload);
      }
    } else {
      this.fallbackFetch(payload);
    }
  }
  fallbackFetch(payload) {
    fetch(this.collectorEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch((err) => {
      console.error("[TrapAlert] Failed to send report:", err);
    });
  }
  captureContext() {
    const activeElement = document.activeElement;
    return {
      activeElement: {
        selector: getElementSelector(activeElement),
        outerHTML: activeElement ? activeElement.outerHTML : null,
        tagName: activeElement ? activeElement.tagName : null,
        role: activeElement ? activeElement.getAttribute("role") : null
      },
      focusHistory: this.focusHistory.map((h) => ({
        selector: h.selector,
        timestamp: h.timestamp
      })),
      pageTitle: document.title,
      scrollPosition: {
        x: window.scrollX,
        y: window.scrollY
      }
    };
  }
  getBrowserMetadata() {
    return {
      userAgent: navigator.userAgent,
      screenSize: {
        width: window.screen.width,
        height: window.screen.height
      },
      viewportSize: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      language: navigator.language,
      platform: navigator.platform,
      timestamp: Date.now()
    };
  }
}
if (typeof window !== "undefined") {
  window.TrapAlert = {
    init: (config) => new TrapAlert(config)
  };
}
export {
  TrapAlert
};
//# sourceMappingURL=trapalert.es.js.map
