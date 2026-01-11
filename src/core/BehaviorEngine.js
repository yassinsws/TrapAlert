import { getElementSelector, hasPointerCursor, getElementXPath } from '../utils/dom.js';

/**
 * BehaviorEngine - Advanced logic for detecting struggle vs power usage
 */
export class BehaviorEngine {
    constructor(struggleScore) {
        this.struggleScore = struggleScore;

        // Efficiency Ratio State
        this.focusBuffer = []; // stores { id, xpath }
        this.maxFocusBuffer = 20;

        // U-Turn State
        this.navigationHistory = []; // stores selector strings
        this.maxNavHistory = 10;

        // Rage Click State
        this.clickHistory = new Map(); // selector -> [timestamps]

        // Dead-End Tab State
        this.tabCount = 0;
        this.lastProductiveAction = Date.now();

        // Input Abandonment State
        this.currentInputObj = null; // { element, startLen, maxLen, typed }

        // Advanced Heuristics State
        this.momentumEndsAt = 0; // Timestamp when success momentum buffer ends
        this.sensitivityMultiplier = 1; // Default sensitivity
        this.sensitivityEndsAt = 0; // Timestamp when high sensitivity ends
        this.interactedElements = new Set(); // Selectors of elements user has productively interacted with
        this.focusClusterBuffer = []; // stores { x, y } for cluster analysis
    }

    /**
     * Helper to add score with momentum and sensitivity applied
     */
    addScore(points, reason) {
        const now = Date.now();
        let finalPoints = points;

        // Mark trigger for velocity gate
        if (this.onTrigger) this.onTrigger();

        // Apply Sensitivity Multiplier
        if (now < this.sensitivityEndsAt) {
            finalPoints *= this.sensitivityMultiplier;
        }

        // Apply Success Momentum (Buffer)
        // Bypass buffer for Rage Clicks or serious context sensitivity
        const isFrustrationMarker = points >= 60 || reason === 'Rage Click';

        if (now < this.momentumEndsAt && !isFrustrationMarker) {
            // Buffer reduces increments by 80%
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
        this.momentumEndsAt = Date.now() + 5000; // 5 second buffer
        this.resetDeadEndTab();
        this.uTurnCounter = 0; // Reset grace period on success

        // High decay rate during momentum
        this.struggleScore.setDecayRate(10);

        // Instant drain
        this.struggleScore.subtract(10);

        // Revert decay rate after 5 seconds
        if (this.decayRevertTimeout) clearTimeout(this.decayRevertTimeout);
        this.decayRevertTimeout = setTimeout(() => {
            this.struggleScore.setDecayRate(2);
        }, 5000);
    }

    /**
     * Register a high-risk context shift (error message, submit click)
     */
    registerContextShift(isSubmit = false) {
        // Clear momentum immediately
        this.momentumEndsAt = 0;
        this.uTurnCounter = 0; // Reset for fresh state

        // Increase sensitivity
        this.sensitivityMultiplier = 2;
        this.sensitivityEndsAt = Date.now() + 30000; // 30 seconds

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

        // 0. History Pruning: Remove events older than 60 seconds
        this.pruneHistory(now);

        // Check if previously interacted (Interaction History)
        if (this.interactedElements.has(selector)) {
            // Do not penalize re-focusing inputs they already worked on
            return;
        }

        // 1. Efficiency Ratio Buffer update
        this.focusBuffer.push({ id, xpath, timestamp: now });
        if (this.focusBuffer.length > this.maxFocusBuffer) {
            this.focusBuffer.shift();
        }

        // 2. Cluster-Loop Detection
        const rect = element.getBoundingClientRect();
        this.focusClusterBuffer.push({
            x: rect.left,
            y: rect.top,
            selector: selector,
            timestamp: now
        });
        if (this.focusClusterBuffer.length > 5) this.focusClusterBuffer.shift();

        this.detectClusterLoop();

        this.evaluateEfficiency();

        // 3. U-Turn Detection
        this.navigationHistory.push(selector);
        if (this.navigationHistory.length > this.maxNavHistory) {
            this.navigationHistory.shift();
        }
        this.detectUTurn();
    }

    pruneHistory(now) {
        const threshold = 60000; // 60 seconds
        this.focusBuffer = this.focusBuffer.filter(item => now - item.timestamp < threshold);
        this.focusClusterBuffer = this.focusClusterBuffer.filter(item => now - item.timestamp < threshold);
    }

    detectClusterLoop() {
        if (this.focusClusterBuffer.length < 5) return;

        // Visual Distance Check: Are all 5 points within a 300px box?
        const xs = this.focusClusterBuffer.map(p => p.x);
        const ys = this.focusClusterBuffer.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const width = maxX - minX;
        const height = maxY - minY;

        if (width < 300 && height < 300) {
            // Check for repetition within the cluster (avoid flagging toolbars)
            const selectors = this.focusClusterBuffer.map(p => p.selector);
            const uniqueInCluster = new Set(selectors).size;

            // If we have 5 events but only 1 or 2 unique elements, we are vibrating in place
            // (U-Turn logic handles 3-element patterns like A-B-C-B-A better)
            if (uniqueInCluster < 3) {
                console.log('[BehaviorEngine] Localized Trap (Cluster) detected');
                this.addScore(10, 'Localized Trap');
            }
        }
    }

    /**
     * "Efficiency Ratio" Logic
     */
    evaluateEfficiency() {
        const totalEvents = this.focusBuffer.length;
        if (totalEvents < 8) return; // Wait for a more robust sample (was 5)

        // Definition of Unique Focus: The count of unique id or xpath attributes
        const uniqueKeys = new Set(this.focusBuffer.map(item => item.id || item.xpath));
        const uniqueCount = uniqueKeys.size;

        const efficiency = uniqueCount / totalEvents;

        // Behavioral Trigger
        if (efficiency < 0.25) { // Slightly more strict (was 0.3)
            // User is hitting the same 4-5 elements repeatedly
            this.addScore(5, 'Low Efficiency');
        } else if (efficiency > 0.8) {
            // Power User Protection
            // Decrease Struggle Score by -20 points
            // Note: Limit frequency of this reward or check if we just crossed the threshold?
            // "Decrease Struggle Score by -20 points (Power User Protection)" implies a one-time bonus or periodic?
            // "per event" isn't specified for the bonus, but typically power user behavior is continuous.
            // If we subtract 20 on EVERY focus event, score will stay 0. That's probably intended.
            // If exploring effectively, we shouldn't count "Dead-End Tabs"
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

        // A -> B -> C -> B -> A
        // A=idx-4, B=idx-3, C=idx-2, B=idx-1, A=idx
        const A1 = h[len - 5];
        const B1 = h[len - 4];
        const C = h[len - 3];
        const B2 = h[len - 2];
        const A2 = h[len - 1];

        if (A1 === A2 && B1 === B2 && A1 !== B1 && B1 !== C) {
            // First U-Turn is often a valid correction.
            // Only penalize if they've done it recently or are in a sensitive state.
            this.uTurnCounter = (this.uTurnCounter || 0) + 1;

            if (this.uTurnCounter > 1) {
                console.log('[BehaviorEngine] Repeated U-Turn detected');
                this.addScore(20, 'Repeated U-Turn'); // Reduced from 30
            } else {
                console.log('[BehaviorEngine] Intentional U-Turn (Normalization)');
                // If it's a one-off, we grant a "grace" score
                this.addScore(5, 'Minor Backtrack');
            }

            // Clear history and reset counter if they start moving again
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
        const likelyInteractive = ['a', 'button', 'input', 'select', 'textarea'].includes(element.tagName.toLowerCase())
            || element.hasAttribute('onclick')
            || element.getAttribute('role') === 'button';

        // 1. Success Verification: Don't give momentum until we see a result (mutation)
        if (likelyInteractive || hasPointer) {
            this.pendingSuccess = {
                timestamp: now,
                type: 'click',
                selector: selector
            };
            // We'll wait for a mutation to confirm
            setTimeout(() => {
                if (this.pendingSuccess && this.pendingSuccess.timestamp === now) {
                    this.pendingSuccess = null; // Expired
                }
            }, 1000);
        }

        // Track interaction for history
        if (['input', 'textarea', 'select'].includes(element.tagName.toLowerCase())) {
            this.interactedElements.add(selector);
        }

        // Check for Submit button click
        if (element.getAttribute('type') === 'submit' || element.getAttribute('role') === 'button') {
            this.registerContextShift(true);
        }

        if (!this.clickHistory.has(selector)) {
            this.clickHistory.set(selector, []);
        }

        const clicks = this.clickHistory.get(selector);
        clicks.push(now);

        const recentClicks = clicks.filter(t => now - t < 2000);
        this.clickHistory.set(selector, recentClicks);

        if (recentClicks.length > 5) {
            if (!hasPointer && !likelyInteractive) {
                // Rage clicking on static text
                this.addScore(60, 'Rage Click (Static)');
                this.clickHistory.delete(selector);
            } else {
                // Rage clicking on a BUTTON (Possible Dead-End/Broken Button)
                // This answers: "what if the button is not working?"
                console.log('[BehaviorEngine] Potential Broken Button / Dead-End Click sequence');
                this.addScore(40, 'Button Mashing'); // Serious frustration but potentially valid (just slow)
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
        // We defer penalty. If the user tabs 15 times but Efficiency is High, evaluateEfficiency resets this.
        // If Efficiency is Low (Looping), this accumulates and penalizes ON TOP of Efficiency penalties.
        this.tabCount++;
        if (this.tabCount > 15) {
            this.addScore(40, 'Dead-End Tab');
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
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            this.currentInputObj = {
                element: element,
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
            this.interactedElements.add(getElementSelector(element)); // Mark as Productive Interaction

            if (element.value.length > this.currentInputObj.maxLenReached) {
                this.currentInputObj.maxLenReached = element.value.length;
            }
        }
    }

    handleInputBlur(element) {
        if (this.currentInputObj && this.currentInputObj.element === element) {
            const finalLen = element.value.length;
            const startLen = this.currentInputObj.startValue.length;
            const charsAdded = this.currentInputObj.maxLenReached - startLen; // rough approximation of "typed"

            // "types <3 chars, deletes them (so back to start or empty), and tabs away (blur)"
            // Simplification: Check if they typed something small and then cleared/reverted it.
            const wasEdited = this.currentInputObj.typed;
            const reverted = finalLen <= startLen; // Or strictly empty? "deletes them" triggers usually mean empty or original state
            const smallEffort = charsAdded > 0 && charsAdded < 3;

            if (wasEdited && smallEffort && reverted) {
                this.addScore(20, 'Input Abandonment');
            }

            this.currentInputObj = null;
        }
    }
}
