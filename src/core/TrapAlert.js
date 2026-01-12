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
        this.collectorEndpoint = config.collectorEndpoint.replace(/\/+$/, '');
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
        this.triggerSnapshot = null;
        this.domSnapshot = null;
        this.triggerSnapshot = null;
        this.audioContext = null;

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
            // 1. Get Screen Stream FIRST (Critical for User Gesture validation in Firefox)
            // Requesting audio: true in getDisplayMedia asks for System Audio
            let screenStream;
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });
            } catch (err) {
                console.error('[TrapAlert] Screen recording permission denied or cancelled:', err);
                // Re-throw to trigger the main catch block with a specific message
                throw new Error(`Screen recording permission denied: ${err.message}`);
            }

            // 2. Capture DOM Snapshot (can be done after stream is active)
            if (this.triggerSnapshot) {
                this.domSnapshot = this.triggerSnapshot;
                console.log('[TrapAlert] Using Contextual DOM Snapshot (from trigger moment).');
            } else {
                this.domSnapshot = captureDOMSnapshot();
                console.log('[TrapAlert] Captured fresh DOM Snapshot (no trigger context found).');
            }

            let combinedStream = screenStream;
            let audioStream = null;

            // 3. Request Microphone (attempt, but allow recording to continue if denied)
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('[TrapAlert] Microphone access granted.');
            } catch (err) {
                console.warn('[TrapAlert] Microphone access denied or not available:', err);
            }

            // Merge tracks using Web Audio API for reliable mixing
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const dest = this.audioContext.createMediaStreamDestination();
                let hasAudio = false;

                // Add System Audio
                if (screenStream.getAudioTracks().length > 0) {
                    const source = this.audioContext.createMediaStreamSource(screenStream);
                    source.connect(dest);
                    console.log('[TrapAlert] Audio Mixing: Connected System Audio');
                    hasAudio = true;
                }

                // Add Microphone Audio
                if (audioStream && audioStream.getAudioTracks().length > 0) {
                    const source = this.audioContext.createMediaStreamSource(audioStream);
                    source.connect(dest);
                    console.log('[TrapAlert] Audio Mixing: Connected Microphone');
                    hasAudio = true;
                }

                const mixedTracks = dest.stream.getAudioTracks();

                // Combine Video + Mixed Audio
                const tracks = [
                    ...screenStream.getVideoTracks(),
                    ...(hasAudio ? mixedTracks : [])
                ];

                console.log(`[TrapAlert] Stream tracks: ${tracks.length} (Video: ${screenStream.getVideoTracks().length}, Audio: ${hasAudio ? 1 : 0})`);
                combinedStream = new MediaStream(tracks);

            } catch (e) {
                console.error('[TrapAlert] Audio Context Error:', e);
                // Fallback to simple merge if Web Audio fails
                const tracks = [
                    ...screenStream.getVideoTracks(),
                    ...screenStream.getAudioTracks(),
                    ...(audioStream ? audioStream.getAudioTracks() : [])
                ];
                combinedStream = new MediaStream(tracks);
            }

            // 3. Initialize MediaRecorder
            this.recordedChunks = [];

            // Check supported types
            const mimeTypes = [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm',
                'video/mp4'
            ];

            let selectedMimeType = '';
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    break;
                }
            }

            console.log(`[TrapAlert] Using MIME type: ${selectedMimeType || 'default'}`);

            const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
            this.mediaRecorder = new MediaRecorder(combinedStream, options);

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
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }


    async finalizeRecording() {
        const videoBlob = new Blob(this.recordedChunks, { type: 'video/webm' });

        const formData = new FormData();
        formData.append('video', videoBlob, 'feedback-recording.webm');
        formData.append('dom', this.domSnapshot);
        formData.append('metadata', JSON.stringify(this.getBrowserMetadata()));
        formData.append('struggleScore', this.struggleScore.get());
        formData.append('description', this.ui.getDescription());
        formData.append('tenantId', this.tenantId);

        console.log(formData.get("transcript"));

        console.log('[TrapAlert] Dispatching multi-modal feedback...');

        // Debug: Log payload details
        console.log('[TrapAlert] Payload details:');
        for (let [key, value] of formData.entries()) {
            if (value instanceof Blob) {
                console.log(`- ${key}: Binary Blob (${value.size} bytes, type: ${value.type})`);
            } else {
                console.log(`- ${key}: ${String(value).substring(0, 100)}${String(value).length > 100 ? '...' : ''}`);
            }
        }

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
                this.triggerSnapshot = null;
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
            // Capture snapshot immediately on manual invocation
            this.triggerSnapshot = captureDOMSnapshot();
            console.log('[TrapAlert] Manual invocation: Contextual DOM Snapshot captured.');
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
            // Capture snapshot immediately on first trigger
            if (!this.triggerSnapshot) {
                this.triggerSnapshot = captureDOMSnapshot();
                console.log('[TrapAlert] Level 1 Trigger: Contextual DOM Snapshot captured.');
            }
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
        this.notificationShown = false;
        this.struggleScore.reset();
        this.triggerLevel = 0; // Full reset on report
        this.triggerSnapshot = null;
    }

    dispatchReport() {
        const payload = {
            tenantId: this.tenantId,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            struggleScore: this.struggleScore.get(),
            description: this.ui.getDescription(),
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
