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

        const sidebar = document.createElement('div');
        sidebar.className = 'trapalert-sidebar';
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
        const closeBtn = this.shadowRoot.querySelector('.trapalert-close');
        const reportBtn = this.shadowRoot.querySelector('#report-btn');
        const dismissBtn = this.shadowRoot.querySelector('#dismiss-btn');

        closeBtn.addEventListener('click', () => this.hide());
        dismissBtn.addEventListener('click', () => {
            this.hide();
            this.onDismiss();
        });
        reportBtn.addEventListener('click', () => {
            this.onReport();
            this.updateMessage('Thank you for reporting. Your feedback helps improve accessibility.');
        });
    }

    show(score) {
        const sidebar = this.shadowRoot.querySelector('.trapalert-sidebar');
        if (sidebar) {
            this.updateScore(score);
            sidebar.classList.add('visible');
            this.playNotificationSound();
            this.announce('TrapAlert: Accessibility barrier detected. Press Alt+T to report.');
        }
    }

    hide() {
        const sidebar = this.shadowRoot.querySelector('.trapalert-sidebar');
        if (sidebar) {
            sidebar.classList.remove('visible');
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
