import { StruggleScore } from './StruggleScore.js';
import { NotificationSystem } from '../ui/NotificationSystem.js';
import { getElementSelector, isInteractiveElement } from '../utils/dom.js';
import { BehaviorEngine } from './BehaviorEngine.js';
import { captureDOMSnapshot } from '../utils/dom-snapshot.js';

/**
 * Main TrapAlert Class
 */
export class TrapAlert {
    constructor(config) {
        if (!config || !config.tenantId || !config.collectorEndpoint) {
            throw new Error('TrapAlert requires tenantId and collectorEndpoint');
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

        // Recording state
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.domSnapshot = null;

        // Watchers state
        this.focusHistory = [];
        this.escPressHistory = [];
        this.lastProductiveTime = Date.now();
        this.startTime = Date.now();
        this.lastTriggerTime = Date.now();
        this.activationThreshold = 100;
        this.triggerLevel = 0; // 0: not triggered, 1: first trigger, 2: escalated trigger

        // UI state
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

            if (timeSinceStart > 600000 && timeSinceLastTrigger > 600000) {
                // > 10 minutes (600,000 ms) without a trigger
                if (this.activationThreshold === 100) { // Only increase once
                    this.activationThreshold = 120; // Increase by 20%
                    console.log('[TrapAlert] Velocity Gate: Increasing threshold to 120 for happy user.');
                }
            }
        }, 60000); // Check every minute
    }

    setupUI() {
        // 1. Inject Global Layout Shift Styles
        const globalStyle = document.createElement('style');
        globalStyle.textContent = `
            body.trapalert-open {
                margin-right: 350px;
                transition: margin 0.3s ease;
                overflow-x: hidden;
            }
            .ta-skip-link {
                position: absolute;
                top: -100px;
                left: 0;
                background: #1a1c2c;
                color: white;
                padding: 15px 25px;
                z-index: 1000000;
                text-decoration: none;
                font-weight: bold;
                border-bottom: 2px solid #fff;
                transition: top 0.2s;
            }
            .ta-skip-link:focus {
                top: 0;
            }
        `;
        document.head.appendChild(globalStyle);

        // 2. Inject Skip Link (Discovery for Screen Readers)
        const skipLink = document.createElement('a');
        skipLink.href = '#';
        skipLink.className = 'ta-skip-link';
        skipLink.textContent = 'Skip to Report Accessibility Issue with TrapAlert';
        skipLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.ui.show(this.struggleScore.get());
        });
        document.body.prepend(skipLink);

        // 3. Setup Shadow DOM Container
        const container = document.createElement('div');
        container.id = 'trapalert-container';
        container.setAttribute('aria-hidden', 'false');
        document.body.appendChild(container);

        const shadowRoot = container.attachShadow({ mode: 'open' });
        this.ui = new NotificationSystem(
            shadowRoot,
            () => this.handleReport(),
            () => this.handleDismiss()
        );

        // Bind recording handlers
        this.ui.onStartRecording = this.handleStartRecording.bind(this);
        this.ui.onStopRecording = this.handleStopRecording.bind(this);
    }

    async handleStartRecording() {
        try {
            // 1. Capture DOM Snapshot immediately
            this.domSnapshot = captureDOMSnapshot();
            console.log('[TrapAlert] DOM Snapshot captured.');

            // 2. Get Screen and Audio streams
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });

            let combinedStream = screenStream;

            try {
                // Request audio separately to merge
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const tracks = [...screenStream.getVideoTracks(), ...audioStream.getAudioTracks()];
                combinedStream = new MediaStream(tracks);
            } catch (err) {
                console.warn('[TrapAlert] Microphone access denied, recording screen without audio.');
            }

            // 3. Initialize MediaRecorder
            this.recordedChunks = [];

            // Check supported types
            const mimeType = 'video/webm;codecs=vp8,opus';
            this.mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.finalizeRecording();
                // Stop all tracks to release hardware
                combinedStream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.ui.setRecordingState('recording');
            console.log('[TrapAlert] Recording started.');

            // Sync: If the user stops screen sharing via browser native UI
            screenStream.getVideoTracks()[0].onended = () => {
                if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.stop();
                }
            };

        } catch (err) {
            console.error('[TrapAlert] Failed to start recording:', err);
            alert('Feedback Recording Error: Please ensure you grant Screen and Microphone permissions.');
        }
    }

    handleStopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.ui.setRecordingState('uploading');
        }
    }

    async finalizeRecording() {
        const videoBlob = new Blob(this.recordedChunks, { type: 'video/webm' });

        const formData = new FormData();
        formData.append('video', videoBlob, 'feedback-recording.webm');
        formData.append('dom', this.domSnapshot);
        formData.append('metadata', JSON.stringify(this.getBrowserMetadata()));
        formData.append('struggleScore', this.struggleScore.get());
        formData.append('tenantId', this.tenantId);

        console.log('[TrapAlert] Dispatching multi-modal feedback...');

        try {
            const response = await fetch(`${this.collectorEndpoint}/feedback`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                console.log('[TrapAlert] Feedback uploaded successfully.');
                this.ui.updateMessage('Feedback sent! Our engineers will audit this snapshot immediately.');
            } else {
                throw new Error('Upload failed');
            }
        } catch (err) {
            console.error('[TrapAlert] Feedback upload failed:', err);
            this.ui.updateMessage('Something went wrong during upload. Please try again.');
        } finally {
            setTimeout(() => {
                this.ui.setRecordingState('idle');
                this.struggleScore.reset();
                this.domSnapshot = null;
            }, 3000);
        }
    }

    attachListeners() {
        // Focus tracking
        window.addEventListener('focusin', this.handleFocusIn.bind(this), true);
        window.addEventListener('focusout', this.handleFocusOut.bind(this), true);

        // Keyboard events
        window.addEventListener('keydown', this.handleKeyDown.bind(this), true);

        // Click events
        window.addEventListener('click', this.handleClick.bind(this), true);

        // Input events (productive behavior)
        window.addEventListener('input', this.handleInput.bind(this), true);

        // Alt+T shortcut for manual report
        window.addEventListener('keydown', this.handleShortcut.bind(this), true);

        // DOM Mutations (Error/Context Shift Detection)
        this.observer = new MutationObserver(this.handleMutations.bind(this));
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['role', 'aria-live', 'class', 'style']
        });

        // Tab Visibility tracking
        window.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[TrapAlert] Tab hidden - resetting frustration engine');
                this.struggleScore.reset();
                this.triggerLevel = 0;
                this.behaviorEngine.resetDeadEndTab();
            }
        });
    }

    handleMutations(mutations) {
        // Notify behavior engine that something happened on the page
        if (mutations.length > 0) {
            this.behaviorEngine.registerMutation();
        }

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        this.checkErrorNode(node);
                    }
                });
            } else if (mutation.type === 'attributes') {
                this.checkErrorNode(mutation.target);
            }
        }
    }

    checkErrorNode(node) {
        if (!node.getAttribute) return;

        const role = node.getAttribute('role');
        const ariaLive = node.getAttribute('aria-live');

        // Check for error markers
        const isError = role === 'alert' ||
            ariaLive === 'assertive' ||
            (node.className && typeof node.className === 'string' && node.className.toLowerCase().includes('error'));

        if (isError) {
            console.log('[TrapAlert] Error message detected (DOM Mutation)');
            this.behaviorEngine.registerContextShift(false);
        }
    }

    handleFocusIn(event) {
        const target = event.target;
        const selector = getElementSelector(target);
        const now = Date.now();

        this.addToTrace('focusin', selector);

        // Context tracking
        this.focusHistory.push({
            element: target,
            selector: selector,
            timestamp: now
        });

        // Prune focus history older than 60 seconds
        this.focusHistory = this.focusHistory.filter(h => now - h.timestamp < 60000);

        if (this.focusHistory.length > 20) {
            this.focusHistory.shift();
        }

        // Analysis
        this.behaviorEngine.handleFocus(target);
        this.behaviorEngine.handleInputFocus(target);
        this.checkThreshold();
    }

    handleFocusOut(event) {
        this.behaviorEngine.handleInputBlur(event.target);
        this.checkThreshold();
    }

    handleKeyDown(event) {
        this.addToTrace('keydown', event.key);

        if (event.key === 'Tab') {
            this.behaviorEngine.handleTab();
            this.checkThreshold();
        }

        if (event.key === 'Escape') {
            this.handleEscapePress();
        }
    }

    handleEscapePress() {
        const now = Date.now();
        this.escPressHistory.push(now);
        this.escPressHistory = this.escPressHistory.filter(t => now - t < 3000);

        if (this.escPressHistory.length >= 3) {
            console.log('[TrapAlert] Rapid Escape presses detected');
            this.struggleScore.add(50);
            this.checkThreshold();
            this.escPressHistory = [];
        }
    }

    handleClick(event) {
        const target = event.target;
        const selector = getElementSelector(target);

        this.addToTrace('click', selector);
        this.markProductiveBehavior();

        this.behaviorEngine.handleClick(target);
        this.checkThreshold();
    }

    handleInput(event) {
        this.addToTrace('input', getElementSelector(event.target));
        this.markProductiveBehavior();
        this.behaviorEngine.handleInputType(event.target);
    }

    markProductiveBehavior() {
        this.lastProductiveTime = Date.now();
        // Reset Dead-End Tab count on productive behavior
        this.behaviorEngine.resetDeadEndTab();
    }

    handleShortcut(event) {
        if (event.altKey && event.key === 't') {
            event.preventDefault();
            this.ui.show(this.struggleScore.get());
        }
    }

    startDecayTimer() {
        // Every second for smooth bucket behavior
        setInterval(() => {
            this.struggleScore.decay();
            if (this.notificationShown) {
                this.ui.updateScore(this.struggleScore.get());
            }
        }, 1000);
    }

    addToTrace(type, detail) {
        this.behavioralTrace.push({
            type: type,
            detail: detail,
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

        // Level 1: Initial Trigger
        if (this.triggerLevel === 0 && score >= firstLimit) {
            console.log(`[TrapAlert] Level 1 Trigger (Score: ${score}, Threshold: ${firstLimit})`);
            this.triggerLevel = 1;
            this.notifyUser();
        }
        // Level 2: Escalation (2x Threshold)
        else if (this.triggerLevel === 1 && score >= secondLimit) {
            console.log(`[TrapAlert] Level 2 Escalation (Score: ${score}, Threshold: ${secondLimit})`);
            this.triggerLevel = 2;
            this.notifyUser();
        }

        // Reset Level if score drops significantly (e.g., back to near 0)
        // This allows the cycle to restart if the user successfully recovers
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
        // Optimization: We keep triggerLevel as is, so it only pops again at 2x threshold
    }

    handleReport() {
        this.dispatchReport();
        this.notificationShown = false;
        this.struggleScore.reset();
        this.triggerLevel = 0; // Full reset on report
    }

    dispatchReport() {
        const payload = {
            tenantId: this.tenantId,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            struggleScore: this.struggleScore.get(),
            behavioralTrace: this.behavioralTrace,
            context: this.captureContext(),
            metadata: this.getBrowserMetadata()
        };

        console.log('[TrapAlert] Dispatching report:', payload);

        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
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
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true
        }).catch(err => {
            console.error('[TrapAlert] Failed to send report:', err);
        });
    }

    captureContext() {
        const activeElement = document.activeElement;

        return {
            activeElement: {
                selector: getElementSelector(activeElement),
                outerHTML: activeElement ? activeElement.outerHTML : null,
                tagName: activeElement ? activeElement.tagName : null,
                role: activeElement ? activeElement.getAttribute('role') : null
            },
            focusHistory: this.focusHistory.map(h => ({
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
