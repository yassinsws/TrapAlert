export class NotificationSystem {
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
    this.ariaLiveRegion = document.createElement('div');
    this.ariaLiveRegion.setAttribute('role', 'status');
    this.ariaLiveRegion.setAttribute('aria-live', 'assertive');
    this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
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
    const style = document.createElement('style');
    style.textContent = `
      :host {
        --ta-blue: #667eea;
        --ta-purple: #764ba2;
        --ta-sidebar-width: 350px;
      }

      .trapalert-sidebar {
        position: fixed;
        top: 0;
        right: calc(var(--ta-sidebar-width) * -1);
        width: var(--ta-sidebar-width);
        height: 100vh;
        background: linear-gradient(135deg, #1a1c2c 0%, #4a192c 100%);
        box-shadow: -4px 0 30px rgba(0, 0, 0, 0.5);
        transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 999999;
        color: white;
        font-family: 'Outfit', sans-serif;
        display: flex;
        flex-direction: column;
        padding: 40px 30px;
        box-sizing: border-box;
        border-left: 1px solid rgba(255, 255, 255, 0.1);
      }

      .trapalert-sidebar.visible {
        right: 0;
      }

      .trapalert-handle {
        position: fixed;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        background: #1a1c2c;
        color: white;
        padding: 15px 8px;
        border-radius: 8px 0 0 8px;
        cursor: pointer;
        writing-mode: vertical-rl;
        text-orientation: mixed;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        border: 1px solid rgba(255,255,255,0.2);
        border-right: none;
        transition: padding 0.2s;
        z-index: 999998;
        box-shadow: -2px 0 10px rgba(0,0,0,0.3);
      }

      .trapalert-handle:hover {
        padding-right: 15px;
        background: #2a2c3c;
      }

      .trapalert-header {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .trapalert-icon {
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
      }

      .trapalert-message {
        font-size: 15px;
        line-height: 1.6;
        margin-bottom: 30px;
        color: rgba(255, 255, 255, 0.8);
      }

      .trapalert-score {
        background: rgba(0, 0, 0, 0.3);
        padding: 20px;
        border-radius: 12px;
        margin-bottom: 25px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }

      .trapalert-score-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        opacity: 0.6;
        margin-bottom: 8px;
      }

      .trapalert-score-value {
        font-size: 42px;
        font-weight: 800;
        background: linear-gradient(to right, #fff, #aab);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .trapalert-button {
        background: white;
        color: #1a1c2c;
        border: none;
        padding: 16px 24px;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        margin-bottom: 12px;
      }

      .trapalert-button:hover {
        background: #f0f0f0;
        transform: translateY(-2px);
      }

      .trapalert-button-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .trapalert-button-secondary:hover {
        background: rgba(255, 255, 255, 0.15);
      }

      .trapalert-close {
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .trapalert-close:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: rotate(90deg);
      }
    `;
    this.shadowRoot.appendChild(style);

    const handle = document.createElement('button');
    handle.className = 'trapalert-handle';
    handle.id = 'ta-handle';
    handle.setAttribute('aria-label', 'Open TrapAlert Reporting Tool');
    handle.textContent = 'Report Barrier';
    this.shadowRoot.appendChild(handle);

    const sidebar = document.createElement('aside');
    sidebar.className = 'trapalert-sidebar';
    sidebar.setAttribute('role', 'complementary');
    sidebar.setAttribute('aria-label', 'TrapAlert Accessibility Tool');

    sidebar.innerHTML = `
      <button class="trapalert-close" id="ta-close" aria-label="Close TrapAlert">×</button>
      <div class="trapalert-header">
        <div class="trapalert-icon">🛡️</div>
        <span>TrapAlert</span>
      </div>
      <div class="trapalert-message">
        We've detected potential navigation barriers. Help us improve the experience for everyone.
      </div>
      <div class="trapalert-score">
        <div class="trapalert-score-label">Frustration Intensity</div>
        <div class="trapalert-score-value" id="score-display">0</div>
      </div>
      <button class="trapalert-button" id="report-btn">
        Submit High-Priority Report
      </button>
      <button class="trapalert-button trapalert-button-secondary" id="dismiss-btn">
        Keep Browsing
      </button>
    `;
    this.shadowRoot.appendChild(sidebar);

    this.bindEvents();
  }

  bindEvents() {
    const handle = this.shadowRoot.querySelector('#ta-handle');
    const closeBtn = this.shadowRoot.querySelector('#ta-close');
    const reportBtn = this.shadowRoot.querySelector('#report-btn');
    const dismissBtn = this.shadowRoot.querySelector('#dismiss-btn');

    handle.addEventListener('click', () => this.show());
    closeBtn.addEventListener('click', () => this.hide());
    dismissBtn.addEventListener('click', () => {
      this.hide();
      this.onDismiss();
    });
    reportBtn.addEventListener('click', () => {
      this.onReport();
      this.updateMessage('Thank you. Our team will audit this page immediately.');
    });
  }

  show(score) {
    const sidebar = this.shadowRoot.querySelector('.trapalert-sidebar');
    const handle = this.shadowRoot.querySelector('#ta-handle');

    if (sidebar) {
      if (score !== undefined) this.updateScore(score);
      sidebar.classList.add('visible');
      if (handle) handle.style.display = 'none';

      document.body.classList.add('trapalert-open');

      // Programmatic focus for accessibility
      setTimeout(() => {
        const closeBtn = this.shadowRoot.querySelector('#ta-close');
        if (closeBtn) closeBtn.focus();
      }, 300);

      this.playNotificationSound();
      this.announce('TrapAlert: Accessibility barrier detected. Sidebar opened.');
    }
  }

  hide() {
    const sidebar = this.shadowRoot.querySelector('.trapalert-sidebar');
    const handle = this.shadowRoot.querySelector('#ta-handle');

    if (sidebar) {
      sidebar.classList.remove('visible');
      if (handle) handle.style.display = 'block';
      document.body.classList.remove('trapalert-open');
    }
  }

  updateScore(score) {
    const scoreDisplay = this.shadowRoot.querySelector('#score-display');
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
    const messageEl = this.shadowRoot.querySelector('.trapalert-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }

  playNotificationSound() {
    // Base64 encoded short beep sound (data URI)
    const audioData = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==';

    try {
      const audio = new Audio(audioData);
      audio.volume = 0.3;
      audio.play().catch(err => {
        console.warn('[TrapAlert] Could not play notification sound:', err);
      });
    } catch (err) {
      console.warn('[TrapAlert] Audio not supported:', err);
    }
  }
}
