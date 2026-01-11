# 🛡️ TrapAlert.js

**TrapAlert.js** is a high-precision, zero-dependency behavioral engine designed to detect accessibility barriers and user frustration in real-time. Unlike traditional analytics, TrapAlert acts as an "invisible layer of empathy," distinguishing between high-efficiency power users and users stuck in loops or dead-ends.

## 🚀 Key Features

- **Zero Dependency**: Standalone Vanilla JS (ES6+), ~18KB UMD/ESM.
- **Invisible Engine**: Monitors behavior without impacting performance or screen reader experience.
- **Shadow DOM UI**: Fully isolated notification system and sidebar.
- **Proactive Detection**: Identifies keyboard traps, rage clicks, and focus loops before users give up.
- **Context-Aware**: Adjusts sensitivity based on page state (e.g., after form submissions or error messages).

---

## 🧠 The Behavioral Brain: How It Works

TrapAlert uses a sophisticated **Struggle Score** system (0-100). When the score hits 100, the "Ghost" UI triggers to offer assistance. The scoring is governed by two primary modules: the **Leaky Bucket** and the **Behavior Engine**.

### 1. Success Momentum (The "Leaky Bucket")
The Struggle Score isn't static—it's a "leaky bucket" that constantly drains.
- **Normal Decay**: 2 points/second.
- **Success Momentum**: Every productive action (typing, valid clicking) increases the drain to **10 points/second** for 5 seconds and instantly empties the bucket by **10 points**.
- **The Philosophy**: As long as the user is "winning" (interacting successfully), the engine stays quiet.

### 2. Notification Escalation (Empathy Thresholds)
To prevent notification fatigue, TrapAlert uses a tiered escalation system:
- **Level 1 (Awareness)**: Triggers at **100 points**. A subtle notice appears.
- **Level 2 (Detection Confirmation)**: If the user dismisses the first notice but remains stuck or frustration continues to **200 points**, the system re-triggers.
- **Reset**: The cycle fully resets if the user successfully recovers (Score < 10) or submits a report.

### 3. Efficiency Ratio
The engine maintains a rolling buffer of focus events to calculate user efficiency.
- **Power User (Efficiency > 0.8)**: User is exploring new content. The Struggle Score is reduced, and "Dead-End Tab" counters are reset.
- **Stuck User (Efficiency < 0.3)**: User is hitting the same 4-5 elements repeatedly. The score increases by **+5 points per event**.

### 3. Context Shift & Sensitivity
TrapAlert knows when a user is in a "high-risk" state.
- **Submission Monitoring**: Clicking a `type="submit"` button clears all momentum and **doubles (2x) score sensitivity** for 30 seconds.
- **Error Detection**: A `MutationObserver` watches for new elements with `role="alert"` or `aria-live="assertive"`. If an error appears, sensitivity spikes immediately.
- **Why?** If a user starts looping right after an error, they are almost certainly trying to find or understand that error.

### 4. Advanced Heuristics
| Metric | Logic | Weight |
| :--- | :--- | :--- |
| **The Cluster-Loop** | 5 focus events within a 300px area with < 4 unique elements. | **+15 pts** (per event) |
| **The U-Turn** | Navigation follows an `A -> B -> C -> B -> A` pattern. | **+30 pts** |
| **Rage Clicking** | >5 clicks in <2s on a non-interactive element. | **+60 pts** |
| **Dead-End Tab** | >15 tabs without a change, input, or submit event. | **+40 pts** |
| **Input Abandonment** | Typing <3 chars, deleting them, and tabbing away. | **+20 pts** |

---

## 🛠️ Installation & Usage

### ⚙️ Initialization
Include the script and initialize with your `tenantId` and `collectorEndpoint`.

```javascript
import { TrapAlert } from './core/TrapAlert.js';

const ta = TrapAlert.init({
    tenantId: 'your-tenant-id',
    collectorEndpoint: 'https://api.your-analytics.com/collect'
});
```

### ⌨️ Manual Trigger
Users can manually open the report sidebar at any time using the shortcut:
`Alt + T`

---

## 🏗️ Architecture

- **Isolation**: All UI elements are injected into a `Shadow DOM` within a `#trapalert-container` to prevent CSS leakage or namespace collisions.
- **Privacy**: The behavioral trace records selectors and timing, never the content of input fields.
- **History Pruning**: Focus buffers are time-stamped. Any event older than 60 seconds is automatically purged to prevent "long-term scanning" from being flagged as a trap.
- **Velocity Gate**: For "Happy Users" (10 minutes without a trigger), the activation threshold increases by 20% to reward long-term successful navigation.

---

## 📦 Developer Scripts

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundles (UMD & ESM)
npm run build
```

---

## ⚖️ License
MIT © 2026 TrapAlert Team.