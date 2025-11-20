(function() {
    'use strict';

    const CONFIG = {
        API_ENDPOINTS: {
            GET_TASKS: 'https://api.seotize.net/get-partner-subtasks',
            DO_TASK: 'https://api.seotize.net/do-task'
        },
        CDN: {
            CRYPTO: 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
            TURNSTILE: 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback',
            SWEETALERT: 'https://cdn.jsdelivr.net/npm/sweetalert2@11',
            GSAP: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js'
        },
        COIN: {
            SIZE: 55,
            MIN_MARGIN: 50,
            SECTION_VARIANCE: 0.3
        },
        ARROW: {
            SIZE: 48,
            OFFSET: 60,
            UPDATE_INTERVAL: 100
        },
        TIMING: {
            WELCOME_DURATION: 5000,
            VERIFIED_STATUS_DURATION: 1500,
            SUCCESS_DURATION: 2000,
            COMPLETION_DURATION: 2500,
            NEXT_COIN_DELAY: 300,
            TURNSTILE_READY_TIMEOUT: 10000,
            CAPTCHA_PRELOAD_DELAY: 1000
        },
        DEBUG: {
            ENABLED: false,
            LOG_POSITION: 'bottom-right'
        }
    };

    const state = {
        systemId: null,
        uniqueId: null,
        coins: [],
        coinElements: [],
        completedTasks: [],
        currentCoinIndex: -1,
        currentArrow: null,
        arrowUpdateInterval: null,
        isProcessing: false,
        dependenciesLoaded: false,
        turnstileReady: false,
        turnstileWidgetId: null,
        captchaContainer: null,
        tasksData: null,
        debugLogs: []
    };

    let domCache = null;
    let debugContainer = null;

    // ============================================
    // DEBUG UTILITIES
    // ============================================

    function debugLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        
        console.log(`[SEOTIZE ${type.toUpperCase()}]`, message);
        
        state.debugLogs.push({ timestamp, message, type });
        
        if (CONFIG.DEBUG.ENABLED) {
            updateDebugUI(logEntry, type);
        }
    }

    function copyLogsToClipboard() {
        const logsText = state.debugLogs
            .map(log => `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`)
            .join('\n');
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(logsText)
                .then(() => showCopyFeedback('✓ Copied!'))
                .catch(() => fallbackCopyToClipboard(logsText));
        } else {
            fallbackCopyToClipboard(logsText);
        }
    }

    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showCopyFeedback('✓ Copied!');
        } catch (err) {
            showCopyFeedback('✗ Failed');
        }
        
        document.body.removeChild(textArea);
    }

    function showCopyFeedback(message) {
        const copyBtn = document.getElementById('seotize-debug-copy');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = message;
            copyBtn.style.background = message.includes('✓') ? '#10b981' : '#ef4444';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '#3b82f6';
            }, 2000);
        }
    }

    function createDebugUI() {
        if (!CONFIG.DEBUG.ENABLED || debugContainer) return;

        debugContainer = document.createElement('div');
        debugContainer.id = 'seotize-debug-log';
        
        const positions = {
            'bottom-right': { bottom: '10px', right: '10px' },
            'bottom-left': { bottom: '10px', left: '10px' },
            'top-right': { top: '10px', right: '10px' },
            'top-left': { top: '10px', left: '10px' }
        };
        
        const pos = positions[CONFIG.DEBUG.LOG_POSITION] || positions['bottom-right'];
        
        Object.assign(debugContainer.style, {
            position: 'fixed',
            ...pos,
            maxWidth: '90vw',
            width: '350px',
            maxHeight: '400px',
            overflowY: 'auto',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            color: '#10b981',
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '12px',
            borderRadius: '8px',
            zIndex: '9999999',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            border: '1px solid #10b981'
        });

        debugContainer.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #10b981; padding-bottom: 6px;">
                <strong style="color: #10b981;">🐛 SEOTIZE DEBUG</strong>
                <div style="display: flex; gap: 4px;">
                    <button id="seotize-debug-copy" style="background: #3b82f6; color: white; border: none; padding: 2px 8px; cursor: pointer; border-radius: 4px; font-size: 10px;">COPY</button>
                    <button id="seotize-debug-close" style="background: #ef4444; color: white; border: none; padding: 2px 8px; cursor: pointer; border-radius: 4px; font-size: 10px;">CLOSE</button>
                </div>
            </div>
            <div id="seotize-debug-content" style="line-height: 1.4;"></div>
        `;

        document.body.appendChild(debugContainer);

        document.getElementById('seotize-debug-copy').addEventListener('click', copyLogsToClipboard);
        document.getElementById('seotize-debug-close').addEventListener('click', () => {
            debugContainer.remove();
            debugContainer = null;
            CONFIG.DEBUG.ENABLED = false;
        });

        debugLog('Debug initialized', 'info');
    }

    function updateDebugUI(message, type = 'info') {
        if (!debugContainer) createDebugUI();

        const logContent = document.getElementById('seotize-debug-content');
        if (!logContent) return;

        const logEntry = document.createElement('div');
        
        const colors = {
            info: '#10b981',
            success: '#06b6d4',
            error: '#ef4444',
            warning: '#f59e0b'
        };

        logEntry.style.color = colors[type] || colors.info;
        logEntry.style.marginBottom = '3px';
        logEntry.style.wordBreak = 'break-word';
        logEntry.textContent = message;

        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;

        while (logContent.children.length > 100) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    function getEngineScriptTag() {
        const scripts = document.getElementsByTagName('script');
        return Array.from(scripts).find(script =>
            script.src.includes('seotize-engine.js')
        );
    }

    function getURLParameter(queryString, name) {
        if (!queryString) return null;
        const params = new URLSearchParams(queryString);
        return params.get(name);
    }

    function getBrowserData() {
        return `${navigator.userAgent}|${navigator.language}|${navigator.platform}|${screen.width}x${screen.height}`;
    }

    function hashData(data) {
        return CryptoJS.MD5(data).toString();
    }

    function getUniqueId() {
        return hashData(getBrowserData());
    }

    function loadScript(src, defer = false) {
        return new Promise((resolve, reject) => {
            debugLog(`Loading: ${src.split('/').pop()}`, 'info');
            const script = document.createElement('script');
            script.src = src;
            script.defer = defer;
            script.onload = () => {
                debugLog(`✓ Loaded: ${src.split('/').pop()}`, 'success');
                resolve();
            };
            script.onerror = () => {
                debugLog(`✗ Failed: ${src.split('/').pop()}`, 'error');
                reject(new Error(`Failed to load: ${src}`));
            };
            domCache.head.appendChild(script);
        });
    }

    // ============================================
    // CAPTCHA MANAGEMENT
    // ============================================

    function preloadCaptcha() {
        debugLog('Pre-rendering captcha container', 'info');
        
        // Create hidden captcha container
        state.captchaContainer = document.createElement('div');
        state.captchaContainer.id = 'seotize-captcha-preload';
        state.captchaContainer.style.position = 'fixed';
        state.captchaContainer.style.opacity = '0';
        state.captchaContainer.style.pointerEvents = 'none';
        state.captchaContainer.style.left = '-9999px';
        state.captchaContainer.style.top = '-9999px';
        
        domCache.body.appendChild(state.captchaContainer);
    }

    function getTurnstileToken() {
        return new Promise((resolve, reject) => {
            debugLog('Requesting captcha verification', 'info');
            
            // Create fresh widget container
            const widgetId = 'seotize-turnstile-widget-' + Date.now();
            
            Swal.fire({
                html: `
                    <div class="seotize-captcha-modal">
                        <div class="seotize-captcha-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <h2 class="seotize-captcha-title">Security Verification</h2>
                        <p class="seotize-captcha-text">Please complete the verification below</p>
                        <div class="seotize-captcha-widget">
                            <div id="${widgetId}"></div>
                        </div>
                    </div>
                `,
                allowOutsideClick: false,
                showConfirmButton: false,
                backdrop: 'rgba(0, 0, 0, 0.75)',
                customClass: {
                    popup: 'seotize-modal-popup'
                },
                didOpen: () => {
                    const widget = document.getElementById(widgetId);
                    
                    // Small delay for mobile rendering
                    setTimeout(() => {
                        if (typeof turnstile !== 'undefined') {
                            debugLog('Rendering Turnstile widget', 'info');
                            try {
                                turnstile.render(widget, {
                                    sitekey: state.systemId,
                                    theme: 'light',
                                    size: 'normal',
                                    callback: (token) => {
                                        debugLog('✓ Verification successful', 'success');
                                        Swal.close();
                                        resolve(token);
                                    },
                                    'error-callback': () => {
                                        debugLog('✗ Verification error', 'error');
                                        Swal.close();
                                        reject(new Error('Verification failed'));
                                    },
                                    'timeout-callback': () => {
                                        debugLog('✗ Verification timeout', 'error');
                                        Swal.close();
                                        reject(new Error('Verification timeout'));
                                    }
                                });
                            } catch (err) {
                                debugLog('✗ Render error: ' + err.message, 'error');
                                Swal.close();
                                reject(err);
                            }
                        } else {
                            debugLog('✗ Turnstile not available', 'error');
                            Swal.close();
                            reject(new Error('Turnstile not loaded'));
                        }
                    }, 100);
                }
            });

            // Timeout fallback
            setTimeout(() => {
                if (Swal.isVisible()) {
                    Swal.close();
                    reject(new Error('Verification timeout'));
                }
            }, 60000);
        });
    }

    // ============================================
    // API CALLS
    // ============================================

    async function fetchPartnerSubtasks(uniqueId, siteKey) {
        try {
            debugLog('Fetching tasks...', 'info');
            const response = await fetch(CONFIG.API_ENDPOINTS.GET_TASKS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unique_id: uniqueId,
                    site_key: siteKey
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            debugLog(`✓ Fetched ${data.subtasks_info?.length || 0} tasks`, 'success');
            return data;
        } catch (error) {
            debugLog(`✗ Fetch error: ${error.message}`, 'error');
            throw error;
        }
    }

    async function submitTask(subtaskId, turnstileToken) {
        try {
            debugLog('Submitting task...', 'info');
            const response = await fetch(CONFIG.API_ENDPOINTS.DO_TASK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unique_id: state.uniqueId,
                    'cf-turnstile-response': turnstileToken,
                    sub_task_id: subtaskId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            debugLog('✓ Task submitted', 'success');
            return result;
        } catch (error) {
            debugLog(`✗ Submit error: ${error.message}`, 'error');
            throw error;
        }
    }

    // ============================================
    // COIN MANAGEMENT
    // ============================================

    function createCoinElement(subtaskId, xPosition, yPosition) {
        const coin = document.createElement('div');
        coin.className = 'seotize-coin';
        coin.setAttribute('data-subtask-id', subtaskId);
        coin.innerHTML = '💎';

        Object.assign(coin.style, {
            position: 'absolute',
            left: `${xPosition}px`,
            top: `${yPosition}px`,
            fontSize: `${CONFIG.COIN.SIZE}px`,
            cursor: 'pointer',
            zIndex: '999999',
            pointerEvents: 'auto',
            userSelect: 'none',
            willChange: 'transform',
            transform: 'translateZ(0)'
        });

        coin.addEventListener('click', () => handleCoinClick(subtaskId), { passive: true });

        return coin;
    }

    function calculateCoinPositions(count) {
        const positions = [];
        const scrollHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        );

        const viewportWidth = window.innerWidth;
        const coinSize = CONFIG.COIN.SIZE;
        const margin = CONFIG.COIN.MIN_MARGIN;
        const sectionHeight = scrollHeight / count;
        const variance = CONFIG.COIN.SECTION_VARIANCE;

        for (let i = 0; i < count; i++) {
            const sectionStart = i * sectionHeight;
            const sectionEnd = (i + 1) * sectionHeight;
            const y = sectionStart + (sectionEnd - sectionStart) * 0.5 + 
                      (Math.random() - 0.5) * (sectionHeight * variance);
            const x = Math.random() * (viewportWidth - coinSize - (margin * 2)) + margin;

            positions.push({ x, y });
        }

        return positions;
    }

    function renderCoins() {
        debugLog(`Rendering ${state.coins.length} coins`, 'info');
        const positions = calculateCoinPositions(state.coins.length);

        state.coins.forEach((subtaskId, index) => {
            const { x, y } = positions[index];
            const coin = createCoinElement(subtaskId, x, y);
            coin.style.display = 'none';
            domCache.body.appendChild(coin);
            state.coinElements.push(coin);
        });
    }

    function displayNextCoin() {
        state.currentCoinIndex++;

        if (state.currentCoinIndex >= state.coinElements.length) {
            debugLog('All coins displayed', 'info');
            return;
        }

        const coin = state.coinElements[state.currentCoinIndex];
        coin.style.display = 'block';

        debugLog(`Displaying coin ${state.currentCoinIndex + 1}/${state.coinElements.length}`, 'info');

        if (typeof gsap !== 'undefined') {
            gsap.from(coin, {
                scale: 0,
                opacity: 0,
                duration: 0.5,
                ease: "back.out(1.7)"
            });

            gsap.to(coin, {
                scale: 1.1,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                duration: 1.5
            });
        }

        createArrowToCoin(coin);
    }

    // ============================================
    // ARROW MANAGEMENT
    // ============================================

    function createArrowToCoin(targetCoin) {
        if (state.currentArrow) {
            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf(state.currentArrow);
            }
            state.currentArrow.remove();
            state.currentArrow = null;
        }
        if (state.arrowUpdateInterval) {
            clearInterval(state.arrowUpdateInterval);
            state.arrowUpdateInterval = null;
        }

        const arrow = document.createElement('div');
        arrow.className = 'seotize-arrow';
        arrow.innerHTML = '👇';

        Object.assign(arrow.style, {
            position: 'fixed',
            fontSize: `${CONFIG.ARROW.SIZE}px`,
            pointerEvents: 'none',
            zIndex: '999998',
            userSelect: 'none',
            willChange: 'transform',
            filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15))'
        });

        domCache.body.appendChild(arrow);
        state.currentArrow = arrow;

        const updateArrowPosition = () => {
            if (!targetCoin || !targetCoin.parentNode) {
                if (arrow && arrow.parentNode) {
                    arrow.remove();
                }
                if (state.arrowUpdateInterval) {
                    clearInterval(state.arrowUpdateInterval);
                    state.arrowUpdateInterval = null;
                }
                return;
            }

            const rect = targetCoin.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            const targetX = rect.left + rect.width / 2;
            const arrowWidth = CONFIG.ARROW.SIZE;
            const arrowHeight = CONFIG.ARROW.SIZE;

            const isVisible = rect.top >= 0 && rect.bottom <= viewportHeight && 
                            rect.left >= 0 && rect.right <= viewportWidth;

            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf(arrow);
            }

            if (isVisible) {
                arrow.style.top = (rect.top - CONFIG.ARROW.OFFSET) + 'px';
                arrow.style.left = (targetX - arrowWidth / 2) + 'px';
                arrow.innerHTML = '👇';
                gsap.to(arrow, {
                    y: 10,
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut",
                    duration: 0.6
                });
            } else {
                if (rect.bottom < 0) {
                    arrow.style.top = '20px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👆';
                    gsap.to(arrow, { y: -10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.top > viewportHeight) {
                    arrow.style.top = (viewportHeight - arrowHeight - 20) + 'px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👇';
                    gsap.to(arrow, { y: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.right < 0) {
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = '20px';
                    arrow.innerHTML = '👈';
                    gsap.to(arrow, { x: -10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.left > viewportWidth) {
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = (viewportWidth - arrowWidth - 20) + 'px';
                    arrow.innerHTML = '👉';
                    gsap.to(arrow, { x: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                }
            }
        };

        updateArrowPosition();
        state.arrowUpdateInterval = setInterval(updateArrowPosition, CONFIG.ARROW.UPDATE_INTERVAL);
    }

    // ============================================
    // COIN CLICK HANDLER
    // ============================================

    async function handleCoinClick(subtaskId) {
        if (state.isProcessing) {
            debugLog('Already processing, ignoring click', 'warning');
            return;
        }

        const clickedCoin = state.coinElements[state.currentCoinIndex];
        const clickedSubtaskId = clickedCoin.getAttribute('data-subtask-id');

        if (clickedSubtaskId !== subtaskId) {
            debugLog('Wrong coin clicked', 'warning');
            return;
        }

        debugLog(`Processing coin: ${subtaskId}`, 'info');
        state.isProcessing = true;

        // Disable all coins during processing
        const coinElements = document.querySelectorAll('.seotize-coin');
        coinElements.forEach(el => el.style.pointerEvents = 'none');

        try {
            // Animate coin collection
            if (typeof gsap !== 'undefined') {
                gsap.to(clickedCoin, {
                    scale: 1.5,
                    opacity: 0,
                    duration: 0.3,
                    ease: "power2.in"
                });
            }

            // Remove arrow
            if (state.currentArrow) {
                if (typeof gsap !== 'undefined') {
                    gsap.killTweensOf(state.currentArrow);
                }
                state.currentArrow.remove();
                state.currentArrow = null;
            }
            if (state.arrowUpdateInterval) {
                clearInterval(state.arrowUpdateInterval);
                state.arrowUpdateInterval = null;
            }

            await new Promise(resolve => setTimeout(resolve, 300));

            // Get verification token
            debugLog('Requesting verification...', 'info');
            const token = await getTurnstileToken();
            
            // Show verifying status
            Swal.fire({
                html: `
                    <div class="seotize-status-modal">
                        <div class="seotize-status-spinner"></div>
                        <h2 class="seotize-status-title">Verifying...</h2>
                        <p class="seotize-status-text">Please wait</p>
                    </div>
                `,
                showConfirmButton: false,
                allowOutsideClick: false,
                backdrop: 'rgba(0, 0, 0, 0.75)',
                customClass: {
                    popup: 'seotize-modal-popup'
                }
            });

            // Submit task
            debugLog('Submitting task...', 'info');
            const result = await submitTask(subtaskId, token);
            
            if (result.status === 'success' || result.code === 200) {
                state.completedTasks.push(subtaskId);
                clickedCoin.remove();

                // Show verified status
                await Swal.fire({
                    html: `
                        <div class="seotize-status-modal">
                            <div class="seotize-status-check">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <h2 class="seotize-status-title">Verified</h2>
                            <p class="seotize-status-text">Task completed successfully</p>
                        </div>
                    `,
                    timer: CONFIG.TIMING.VERIFIED_STATUS_DURATION,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    backdrop: 'rgba(0, 0, 0, 0.75)',
                    customClass: {
                        popup: 'seotize-modal-popup'
                    }
                });

                const remainingTasks = state.coinElements.length - (state.currentCoinIndex + 1);
                const allTasksComplete = result.data?.all_tasks_complete || remainingTasks === 0;

                if (!allTasksComplete) {
                    // Show progress
                    await Swal.fire({
                        html: `
                            <div class="seotize-progress-modal">
                                <div class="seotize-progress-icon">💎</div>
                                <h2 class="seotize-progress-title">Diamond Collected!</h2>
                                <div class="seotize-progress-stats">
                                    <div class="seotize-progress-number">
                                        <span class="seotize-progress-current">${state.completedTasks.length}</span>
                                        <span class="seotize-progress-divider">/</span>
                                        <span class="seotize-progress-total">${state.coinElements.length}</span>
                                    </div>
                                    <div class="seotize-progress-label">Complete</div>
                                </div>
                                <div class="seotize-progress-bar-container">
                                    <div class="seotize-progress-bar-fill" style="width: ${(state.completedTasks.length / state.coinElements.length) * 100}%"></div>
                                </div>
                                ${remainingTasks > 0 ? `<p class="seotize-progress-remaining">${remainingTasks} more to go</p>` : ''}
                            </div>
                        `,
                        timer: CONFIG.TIMING.SUCCESS_DURATION,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        backdrop: 'rgba(0, 0, 0, 0.75)',
                        customClass: {
                            popup: 'seotize-modal-popup'
                        }
                    });

                    // Display next coin after delay
                    setTimeout(() => {
                        debugLog('Displaying next coin...', 'info');
                        displayNextCoin();
                        state.isProcessing = false;
                        coinElements.forEach(el => el.style.pointerEvents = 'auto');
                    }, CONFIG.TIMING.NEXT_COIN_DELAY);
                } else {
                    // All tasks complete
                    await Swal.fire({
                        html: `
                            <div class="seotize-completion-modal">
                                <div class="seotize-completion-icon">🏆</div>
                                <h2 class="seotize-completion-title">All Complete!</h2>
                                <p class="seotize-completion-text">You collected all ${state.coinElements.length} diamonds</p>
                                <div class="seotize-completion-redirect">Redirecting to dashboard...</div>
                            </div>
                        `,
                        timer: CONFIG.TIMING.COMPLETION_DURATION,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        backdrop: 'rgba(0, 0, 0, 0.75)',
                        customClass: {
                            popup: 'seotize-modal-popup'
                        }
                    });
                    
                    debugLog('✓ All tasks complete, redirecting...', 'success');
                    window.location.href = 'https://seotize.net/partner/dashboard';
                }
            } else {
                throw new Error(result.data?.message || 'Task submission failed');
            }
        } catch (error) {
            debugLog(`Error: ${error.message}`, 'error');
            
            Swal.fire({
                html: `
                    <div class="seotize-error-modal">
                        <div class="seotize-error-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                        </div>
                        <h2 class="seotize-error-title">Error</h2>
                        <p class="seotize-error-text">${error.message || 'Something went wrong. Please try again.'}</p>
                        <button class="seotize-error-button" onclick="Swal.close()">Try Again</button>
                    </div>
                `,
                showConfirmButton: false,
                allowOutsideClick: true,
                backdrop: 'rgba(0, 0, 0, 0.75)',
                customClass: {
                    popup: 'seotize-modal-popup'
                }
            });

            state.isProcessing = false;
            coinElements.forEach(el => el.style.pointerEvents = 'auto');
        }
    }

    // ============================================
    // STYLES
    // ============================================

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            * {
                -webkit-tap-highlight-color: transparent;
            }

            .seotize-coin {
                filter: drop-shadow(0 4px 12px rgba(59, 130, 246, 0.3));
                will-change: transform;
                transform: translateZ(0);
                transition: transform 0.15s ease;
            }

            .seotize-coin:active {
                transform: scale(1.2) !important;
            }

            .seotize-arrow {
                will-change: transform;
                transform: translateZ(0);
            }

            /* Modal Base */
            .seotize-modal-popup {
                padding: 0 !important;
                background: white !important;
                border-radius: 12px !important;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important;
                max-width: 90vw !important;
                width: 400px !important;
            }

            /* Captcha Modal */
            .seotize-captcha-modal {
                padding: 32px 24px;
                text-align: center;
            }

            .seotize-captcha-icon {
                width: 48px;
                height: 48px;
                margin: 0 auto 16px;
                color: #3b82f6;
            }

            .seotize-captcha-title {
                font-size: 20px;
                font-weight: 600;
                color: #111827;
                margin: 0 0 8px 0;
                line-height: 1.3;
            }

            .seotize-captcha-text {
                font-size: 14px;
                color: #6b7280;
                margin: 0 0 24px 0;
                line-height: 1.5;
            }

            .seotize-captcha-widget {
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 65px;
            }

            /* Status Modal (Verifying & Verified) */
            .seotize-status-modal {
                padding: 32px 24px;
                text-align: center;
            }

            .seotize-status-spinner {
                width: 48px;
                height: 48px;
                margin: 0 auto 16px;
                border: 3px solid #e5e7eb;
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: seotize-spin 0.8s linear infinite;
            }

            @keyframes seotize-spin {
                to { transform: rotate(360deg); }
            }

            .seotize-status-check {
                width: 64px;
                height: 64px;
                margin: 0 auto 16px;
                color: #10b981;
                animation: seotize-check-in 0.3s ease;
            }

            @keyframes seotize-check-in {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); opacity: 1; }
            }

            .seotize-status-title {
                font-size: 20px;
                font-weight: 600;
                color: #111827;
                margin: 0 0 8px 0;
            }

            .seotize-status-text {
                font-size: 14px;
                color: #6b7280;
                margin: 0;
            }

            /* Progress Modal */
            .seotize-progress-modal {
                padding: 32px 24px;
                text-align: center;
            }

            .seotize-progress-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }

            .seotize-progress-title {
                font-size: 20px;
                font-weight: 600;
                color: #111827;
                margin: 0 0 20px 0;
            }

            .seotize-progress-stats {
                margin-bottom: 16px;
            }

            .seotize-progress-number {
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: 6px;
                margin-bottom: 4px;
            }

            .seotize-progress-current {
                font-size: 32px;
                font-weight: 700;
                color: #10b981;
                line-height: 1;
            }

            .seotize-progress-divider {
                font-size: 20px;
                color: #d1d5db;
                font-weight: 600;
            }

            .seotize-progress-total {
                font-size: 20px;
                color: #6b7280;
                font-weight: 600;
            }

            .seotize-progress-label {
                font-size: 13px;
                color: #6b7280;
                font-weight: 500;
            }

            .seotize-progress-bar-container {
                width: 100%;
                height: 6px;
                background: #f3f4f6;
                border-radius: 3px;
                overflow: hidden;
                margin-bottom: 12px;
            }

            .seotize-progress-bar-fill {
                height: 100%;
                background: #10b981;
                border-radius: 3px;
                transition: width 0.6s ease;
            }

            .seotize-progress-remaining {
                font-size: 13px;
                color: #6b7280;
                margin: 0;
            }

            /* Completion Modal */
            .seotize-completion-modal {
                padding: 32px 24px;
                text-align: center;
            }

            .seotize-completion-icon {
                font-size: 56px;
                margin-bottom: 16px;
            }

            .seotize-completion-title {
                font-size: 24px;
                font-weight: 700;
                color: #111827;
                margin: 0 0 8px 0;
            }

            .seotize-completion-text {
                font-size: 14px;
                color: #6b7280;
                margin: 0 0 16px 0;
            }

            .seotize-completion-redirect {
                font-size: 13px;
                color: #3b82f6;
                font-weight: 500;
            }

            /* Error Modal */
            .seotize-error-modal {
                padding: 32px 24px;
                text-align: center;
            }

            .seotize-error-icon {
                width: 48px;
                height: 48px;
                margin: 0 auto 16px;
                color: #ef4444;
            }

            .seotize-error-title {
                font-size: 20px;
                font-weight: 600;
                color: #111827;
                margin: 0 0 8px 0;
            }

            .seotize-error-text {
                font-size: 14px;
                color: #6b7280;
                margin: 0 0 20px 0;
                line-height: 1.5;
            }

            .seotize-error-button {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 10px 24px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .seotize-error-button:hover {
                background: #2563eb;
            }

            .seotize-error-button:active {
                transform: scale(0.98);
            }

            /* Welcome Modal */
            .seotize-welcome-modal {
                padding: 32px 24px;
                text-align: center;
            }

            .seotize-welcome-icon {
                font-size: 56px;
                margin-bottom: 16px;
            }

            .seotize-welcome-title {
                font-size: 24px;
                font-weight: 700;
                color: #111827;
                margin: 0 0 8px 0;
            }

            .seotize-welcome-text {
                font-size: 14px;
                color: #6b7280;
                margin: 0 0 24px 0;
                line-height: 1.5;
            }

            .seotize-welcome-features {
                background: #f9fafb;
                padding: 16px;
                border-radius: 8px;
                margin-bottom: 16px;
                text-align: left;
            }

            .seotize-welcome-feature {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                font-size: 14px;
                color: #374151;
            }

            .seotize-welcome-feature:last-child {
                margin-bottom: 0;
            }

            .seotize-welcome-feature-icon {
                font-size: 20px;
                flex-shrink: 0;
            }

            .seotize-welcome-countdown {
                font-size: 13px;
                color: #9ca3af;
            }

            /* Timer Progress Bar */
            .swal2-timer-progress-bar {
                background: #e5e7eb !important;
                height: 3px !important;
            }

            /* Mobile Optimizations */
            @media (max-width: 480px) {
                .seotize-modal-popup {
                    width: 95vw !important;
                }
                
                .seotize-captcha-modal,
                .seotize-status-modal,
                .seotize-progress-modal,
                .seotize-completion-modal,
                .seotize-error-modal,
                .seotize-welcome-modal {
                    padding: 28px 20px;
                }
                
                .seotize-captcha-widget iframe,
                .seotize-captcha-widget > div {
                    max-width: 100% !important;
                    transform: scale(0.95);
                    transform-origin: center;
                }
            }

            @media (max-width: 360px) {
                .seotize-captcha-widget iframe,
                .seotize-captcha-widget > div {
                    transform: scale(0.9);
                }
            }
        `;
        domCache.head.appendChild(style);
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async function waitForDependencies() {
        return new Promise((resolve) => {
            const checkDeps = () => {
                if (typeof CryptoJS !== 'undefined' &&
                    typeof Swal !== 'undefined' &&
                    typeof gsap !== 'undefined') {
                    state.dependenciesLoaded = true;
                    debugLog('✓ All dependencies loaded', 'success');
                    resolve();
                } else {
                    setTimeout(checkDeps, 50);
                }
            };
            checkDeps();
        });
    }

    async function initializeEngine() {
        try {
            debugLog('Initializing engine...', 'info');
            await waitForDependencies();

            state.uniqueId = getUniqueId();
            debugLog(`Unique ID: ${state.uniqueId.substring(0, 8)}...`, 'info');
            
            const data = await fetchPartnerSubtasks(state.uniqueId, state.systemId);

            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                debugLog('No tasks available', 'warning');
                Swal.fire({
                    html: `
                        <div class="seotize-welcome-modal">
                            <div class="seotize-welcome-icon">✅</div>
                            <h2 class="seotize-welcome-title">All Done!</h2>
                            <p class="seotize-welcome-text">You have completed all available tasks.</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    backdrop: 'rgba(0, 0, 0, 0.75)',
                    customClass: {
                        popup: 'seotize-modal-popup'
                    }
                });
                return;
            }

            state.coins = data.subtasks_info
                .filter(task => task.status === 'incomplete')
                .map(task => task.subtask_id);

            if (state.coins.length === 0) {
                debugLog('All tasks complete', 'success');
                Swal.fire({
                    html: `
                        <div class="seotize-welcome-modal">
                            <div class="seotize-welcome-icon">✅</div>
                            <h2 class="seotize-welcome-title">All Complete!</h2>
                            <p class="seotize-welcome-text">You have finished all your tasks.</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    backdrop: 'rgba(0, 0, 0, 0.75)',
                    customClass: {
                        popup: 'seotize-modal-popup'
                    }
                });
                return;
            }

            debugLog(`Found ${state.coins.length} incomplete tasks`, 'success');

            // Show welcome
            await Swal.fire({
                html: `
                    <div class="seotize-welcome-modal">
                        <div class="seotize-welcome-icon">💎</div>
                        <h2 class="seotize-welcome-title">Welcome Partner!</h2>
                        <p class="seotize-welcome-text">Collect diamonds to earn your reward</p>
                        <div class="seotize-welcome-features">
                            <div class="seotize-welcome-feature">
                                <span class="seotize-welcome-feature-icon">🎯</span>
                                <span>Follow the arrow to find diamonds</span>
                            </div>
                            <div class="seotize-welcome-feature">
                                <span class="seotize-welcome-feature-icon">💎</span>
                                <span>Click each diamond to collect it</span>
                            </div>
                            <div class="seotize-welcome-feature">
                                <span class="seotize-welcome-feature-icon">🏆</span>
                                <span>Collect all ${state.coins.length} to complete</span>
                            </div>
                        </div>
                        <p class="seotize-welcome-countdown">Starting soon...</p>
                    </div>
                `,
                timer: CONFIG.TIMING.WELCOME_DURATION,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false,
                backdrop: 'rgba(0, 0, 0, 0.75)',
                customClass: {
                    popup: 'seotize-modal-popup'
                }
            });

            // Preload captcha for better mobile performance
            setTimeout(() => {
                preloadCaptcha();
            }, CONFIG.TIMING.CAPTCHA_PRELOAD_DELAY);

            renderCoins();
            displayNextCoin();

            debugLog('✓ Engine initialized', 'success');

        } catch (error) {
            debugLog(`Initialization error: ${error.message}`, 'error');
            console.error('Init error:', error);
        }
    }

    function setupTurnstile() {
        const div = document.createElement('div');
        div.className = 'cf-turnstile';
        div.style.position = 'fixed';
        div.style.opacity = '0';
        div.style.pointerEvents = 'none';
        div.style.left = '-9999px';
        div.style.top = '-9999px';
        
        domCache.body.insertBefore(div, domCache.body.firstChild);
    }

    async function loadDependencies() {
        try {
            debugLog('Loading dependencies...', 'info');
            const scriptPromises = [
                loadScript(CONFIG.CDN.CRYPTO),
                loadScript(CONFIG.CDN.SWEETALERT),
                loadScript(CONFIG.CDN.GSAP),
                loadScript(CONFIG.CDN.TURNSTILE, true)
            ];

            await Promise.all(scriptPromises);
            debugLog('✓ Dependencies loaded', 'success');
            return true;
        } catch (error) {
            debugLog(`Load error: ${error.message}`, 'error');
            return false;
        }
    }

    async function bootstrap() {
        domCache = {
            body: document.body,
            head: document.head
        };

        if (CONFIG.DEBUG.ENABLED) {
            createDebugUI();
        }

        const engineScript = getEngineScriptTag();
        if (!engineScript) {
            debugLog('Engine script not found', 'error');
            return;
        }

        const queryString = engineScript.src.split('?')[1];
        state.systemId = getURLParameter(queryString, 'id');
        
        if (!state.systemId) {
            debugLog('System ID not found', 'error');
            return;
        }

        debugLog(`System ID: ${state.systemId}`, 'info');
        window.SYSYID = state.systemId;

        if (!document.referrer.includes('google.com')) {
            debugLog('Not from Google referrer', 'warning');
            return;
        }

        injectStyles();

        const loaded = await loadDependencies();
        if (!loaded) {
            debugLog('Failed to load dependencies', 'error');
            return;
        }

        setupTurnstile();
        initializeEngine();
    }

    // Turnstile callback
    window.onloadTurnstileCallback = function() {
        if (typeof turnstile !== 'undefined') {
            state.turnstileReady = true;
            debugLog('✓ Turnstile ready', 'success');
        }
    };

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
