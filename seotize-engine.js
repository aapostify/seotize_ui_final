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
        TIMING: {
            WELCOME_DURATION: 6000,
            SUCCESS_DURATION: 2000,
            COMPLETION_DURATION: 2500,
            POLL_INTERVAL: 50,
            TURNSTILE_READY_TIMEOUT: 20000,
            TURNSTILE_TOKEN_TIMEOUT: 30000
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
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        dependenciesLoaded: false,
        turnstileReady: false,
        turnstileWidgetId: null,
        debugLogs: []
    };

    let domCache = null;
    let debugContainer = null;

    function getResponsiveSizes() {
        const vw = window.innerWidth;
        const isMobile = vw < 768;
        
        return {
            coin: isMobile ? 45 : 55,
            arrow: isMobile ? 40 : 48,
            margin: isMobile ? 30 : 50,
            arrowOffset: isMobile ? 50 : 60
        };
    }

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
            navigator.clipboard.writeText(logsText).then(() => {
                showCopyFeedback('✓ Copied!');
            }).catch(() => {
                fallbackCopyToClipboard(logsText);
            });
        } else {
            fallbackCopyToClipboard(logsText);
        }
    }

    function fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            showCopyFeedback('✓ Copied!');
        } catch (err) {
            showCopyFeedback('✗ Copy failed');
        }
        
        document.body.removeChild(textArea);
    }

    function showCopyFeedback(message) {
        const copyBtn = document.getElementById('seotize-debug-copy');
        if (copyBtn) {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = message;
            copyBtn.style.background = message.includes('✓') ? '#10b981' : '#ff0000';
            
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = '#6366f1';
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
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: '#00ff00',
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '10px',
            borderRadius: '8px',
            zIndex: '9999999',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
            border: '2px solid #00ff00'
        });

        const header = document.createElement('div');
        header.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #00ff00; padding-bottom: 5px;">
                <strong style="color: #00ff00;">🐛 SEOTIZE DEBUG</strong>
                <div style="display: flex; gap: 5px;">
                    <button id="seotize-debug-copy" style="background: #6366f1; color: white; border: none; padding: 2px 8px; cursor: pointer; border-radius: 4px; font-size: 10px;">COPY</button>
                    <button id="seotize-debug-close" style="background: #ff0000; color: white; border: none; padding: 2px 8px; cursor: pointer; border-radius: 4px; font-size: 10px;">CLOSE</button>
                </div>
            </div>
        `;
        
        debugContainer.appendChild(header);

        const logContent = document.createElement('div');
        logContent.id = 'seotize-debug-content';
        logContent.style.lineHeight = '1.4';
        debugContainer.appendChild(logContent);

        document.body.appendChild(debugContainer);

        document.getElementById('seotize-debug-copy').addEventListener('click', copyLogsToClipboard);
        document.getElementById('seotize-debug-close').addEventListener('click', () => {
            debugContainer.remove();
            debugContainer = null;
            CONFIG.DEBUG.ENABLED = false;
        });

        debugLog('Debug mode initialized', 'info');
    }

    function updateDebugUI(message, type = 'info') {
        if (!debugContainer) {
            createDebugUI();
        }

        const logContent = document.getElementById('seotize-debug-content');
        if (!logContent) return;

        const logEntry = document.createElement('div');
        
        const colors = {
            info: '#00ff00',
            success: '#00ffff',
            error: '#ff0000',
            warning: '#ffff00'
        };

        logEntry.style.color = colors[type] || colors.info;
        logEntry.style.marginBottom = '3px';
        logEntry.style.wordBreak = 'break-word';
        logEntry.textContent = message;

        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;

        const maxLogs = 100;
        while (logContent.children.length > maxLogs) {
            logContent.removeChild(logContent.firstChild);
        }
    }

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
            debugLog(`Loading script: ${src}`, 'info');
            const script = document.createElement('script');
            script.src = src;
            script.defer = defer;
            script.onload = () => {
                debugLog(`✓ Loaded: ${src}`, 'success');
                resolve();
            };
            script.onerror = () => {
                debugLog(`✗ Failed to load: ${src}`, 'error');
                reject(new Error(`Failed to load script: ${src}`));
            };
            domCache.head.appendChild(script);
        });
    }

    async function loadDependencies() {
        try {
            await Promise.all([
                loadScript(CONFIG.CDN.CRYPTO),
                loadScript(CONFIG.CDN.SWEETALERT),
                loadScript(CONFIG.CDN.GSAP),
                loadScript(CONFIG.CDN.TURNSTILE, true)
            ]);
            return true;
        } catch (error) {
            console.error('Load error:', error);
            return false;
        }
    }

    async function waitForDependencies() {
        return new Promise((resolve) => {
            const checkDeps = () => {
                if (typeof CryptoJS !== 'undefined' &&
                    typeof Swal !== 'undefined' &&
                    typeof gsap !== 'undefined') {
                    state.dependenciesLoaded = true;
                    debugLog('✓ Dependencies loaded', 'success');
                    resolve();
                } else {
                    setTimeout(checkDeps, 50);
                }
            };
            checkDeps();
        });
    }

    function setupTurnstile() {
        const div = document.createElement('div');
        div.className = 'cf-turnstile';
        div.setAttribute('data-theme', 'light');
        div.setAttribute('data-sitekey', state.systemId);
        div.setAttribute('data-callback', 'onTurnstileCallback');
        div.setAttribute('data-size', 'normal');
        div.setAttribute('data-retry', 'auto');
        div.setAttribute('data-retry-interval', '8000');
        div.setAttribute('data-refresh-expired', 'auto');
        div.setAttribute('data-appearance', 'execute');
        
        domCache.body.insertBefore(div, domCache.body.firstChild);
    }

    async function waitForTurnstileReady() {
        debugLog('Waiting for Turnstile...', 'info');
        
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkReady = () => {
                if (state.turnstileReady && state.turnstileWidgetId !== null) {
                    debugLog(`✓ Turnstile ready`, 'success');
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > CONFIG.TIMING.TURNSTILE_READY_TIMEOUT) {
                    debugLog('✗ Turnstile timeout', 'error');
                    reject(new Error('Turnstile timeout'));
                    return;
                }
                
                setTimeout(checkReady, CONFIG.TIMING.POLL_INTERVAL);
            };
            
            checkReady();
        });
    }

    async function getTurnstileToken() {
        try {
            await waitForTurnstileReady();

            if (state.isMobile) {
                debugLog('Using mobile visible captcha', 'info');
                return await getVisibleToken();
            }
            
            debugLog('Using desktop invisible captcha', 'info');
            return await getInvisibleToken();
            
        } catch (error) {
            debugLog(`✗ Token error: ${error.message}`, 'error');
            throw error;
        }
    }

    function getVisibleToken() {
        return new Promise((resolve, reject) => {
            debugLog('Showing captcha modal', 'info');
            
            Swal.fire({
                html: `
                    <div class="seotize-captcha-container">
                        <div class="seotize-captcha-icon">🔒</div>
                        <h2 class="seotize-captcha-title">Quick Security Check</h2>
                        <p class="seotize-captcha-text">Please verify you're human</p>
                        <div id="seotize-captcha-widget"></div>
                    </div>
                `,
                allowOutsideClick: false,
                showConfirmButton: false,
                background: 'transparent',
                backdrop: 'rgba(0, 0, 0, 0.9)',
                customClass: {
                    popup: 'seotize-captcha-popup'
                },
                didOpen: () => {
                    const widget = document.getElementById('seotize-captcha-widget');
                    
                    if (typeof turnstile !== 'undefined') {
                        debugLog('Rendering visible turnstile', 'info');
                        try {
                            turnstile.render(widget, {
                                sitekey: state.systemId,
                                theme: 'light',
                                size: 'normal',
                                callback: (token) => {
                                    debugLog('✓ Captcha solved', 'success');
                                    Swal.close();
                                    resolve(token);
                                },
                                'error-callback': () => {
                                    debugLog('✗ Captcha error', 'error');
                                    Swal.close();
                                    reject(new Error('Verification failed'));
                                },
                                'timeout-callback': () => {
                                    debugLog('✗ Captcha timeout', 'error');
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
                        debugLog('✗ Turnstile not loaded', 'error');
                        Swal.close();
                        reject(new Error('Turnstile not loaded'));
                    }
                }
            });

            setTimeout(() => {
                Swal.close();
                reject(new Error('Verification timeout'));
            }, CONFIG.TIMING.TURNSTILE_TOKEN_TIMEOUT);
        });
    }

    function getInvisibleToken() {
        return new Promise((resolve, reject) => {
            debugLog('Resetting invisible widget', 'info');
            
            if (typeof turnstile !== 'undefined') {
                turnstile.reset(state.turnstileWidgetId);
            }

            const startTime = Date.now();
            const checkToken = () => {
                const responseElement = document.getElementsByName('cf-turnstile-response')[0];

                if (responseElement?.value) {
                    const token = responseElement.value;
                    debugLog(`✓ Token received`, 'success');
                    resolve(token);
                    return;
                }

                if (Date.now() - startTime > CONFIG.TIMING.TURNSTILE_TOKEN_TIMEOUT) {
                    debugLog(`✗ Token timeout`, 'error');
                    reject(new Error('Token timeout'));
                    return;
                }

                setTimeout(checkToken, CONFIG.TIMING.POLL_INTERVAL);
            };

            checkToken();
        });
    }

    async function fetchPartnerSubtasks(uniqueId, siteKey) {
        try {
            debugLog('Fetching tasks from API', 'info');
            const response = await fetch(CONFIG.API_ENDPOINTS.GET_TASKS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unique_id: uniqueId,
                    site_key: siteKey
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            debugLog(`✓ Tasks received: ${data.subtasks_info?.length || 0}`, 'success');
            return data;
        } catch (error) {
            debugLog(`✗ API error: ${error.message}`, 'error');
            throw error;
        }
    }

    async function submitTask(subtaskId, turnstileToken) {
        try {
            debugLog(`Submitting task: ${subtaskId}`, 'info');
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            debugLog('✓ Task submitted', 'success');
            return result;
        } catch (error) {
            debugLog(`✗ Submit error: ${error.message}`, 'error');
            throw error;
        }
    }

    function calculateCoinPositions(count) {
        const sizes = getResponsiveSizes();
        const positions = [];
        const scrollHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        );

        const viewportWidth = window.innerWidth;
        const sectionHeight = scrollHeight / count;
        const variance = 0.3;

        for (let i = 0; i < count; i++) {
            const sectionStart = i * sectionHeight;
            const sectionEnd = (i + 1) * sectionHeight;
            const y = sectionStart + (sectionEnd - sectionStart) * 0.5 + (Math.random() - 0.5) * (sectionHeight * variance);
            const x = Math.random() * (viewportWidth - sizes.coin - (sizes.margin * 2)) + sizes.margin;

            positions.push({ x, y });
        }

        return positions;
    }

    function createCoinElement(subtaskId, xPosition, yPosition) {
        const sizes = getResponsiveSizes();
        const coin = document.createElement('div');
        coin.className = 'seotize-coin';
        coin.setAttribute('data-subtask-id', subtaskId);
        coin.innerHTML = '💎';

        Object.assign(coin.style, {
            position: 'absolute',
            left: `${xPosition}px`,
            top: `${yPosition}px`,
            fontSize: `${sizes.coin}px`,
            cursor: 'pointer',
            zIndex: '999999',
            pointerEvents: 'auto',
            userSelect: 'none'
        });

        coin.addEventListener('click', () => handleCoinClick(subtaskId), { passive: true });

        return coin;
    }

    function renderCoins() {
        const positions = calculateCoinPositions(state.coins.length);

        state.coins.forEach((subtaskId, index) => {
            const { x, y } = positions[index];
            const coin = createCoinElement(subtaskId, x, y);
            coin.style.display = 'none';
            domCache.body.appendChild(coin);
            state.coinElements.push(coin);
        });
        
        debugLog(`✓ Rendered ${state.coinElements.length} coins`, 'success');
    }

    function displayNextCoin() {
        state.currentCoinIndex++;

        if (state.currentCoinIndex >= state.coinElements.length) {
            return;
        }

        const coin = state.coinElements[state.currentCoinIndex];
        coin.style.display = 'block';

        if (typeof gsap !== 'undefined') {
            gsap.from(coin, {
                scale: 0,
                opacity: 0,
                duration: 0.5,
                ease: "back.out(1.7)"
            });

            gsap.to(coin, {
                scale: 1.15,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                duration: 1.5
            });
        }

        createArrowToCoin(coin);
        debugLog(`Displaying coin ${state.currentCoinIndex + 1}/${state.coinElements.length}`, 'info');
    }

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

        const sizes = getResponsiveSizes();
        const arrow = document.createElement('div');
        arrow.className = 'seotize-arrow';
        arrow.innerHTML = '👇';

        Object.assign(arrow.style, {
            position: 'fixed',
            fontSize: `${sizes.arrow}px`,
            pointerEvents: 'none',
            zIndex: '999998',
            userSelect: 'none'
        });

        domCache.body.appendChild(arrow);
        state.currentArrow = arrow;

        const updateArrowPosition = () => {
            if (!targetCoin || !targetCoin.parentNode) {
                if (arrow && arrow.parentNode) {
                    arrow.parentNode.removeChild(arrow);
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

            const isVisible = rect.top >= 0 && rect.bottom <= viewportHeight && rect.left >= 0 && rect.right <= viewportWidth;

            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf(arrow);
            }

            if (isVisible) {
                arrow.style.top = (rect.top - sizes.arrowOffset) + 'px';
                arrow.style.left = (targetX - sizes.arrow / 2) + 'px';
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
                    arrow.style.top = '10px';
                    arrow.style.left = (viewportWidth / 2 - sizes.arrow / 2) + 'px';
                    arrow.innerHTML = '👆';
                    gsap.to(arrow, { y: -10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.top > viewportHeight) {
                    arrow.style.top = (viewportHeight - sizes.arrow - 10) + 'px';
                    arrow.style.left = (viewportWidth / 2 - sizes.arrow / 2) + 'px';
                    arrow.innerHTML = '👇';
                    gsap.to(arrow, { y: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.right < 0) {
                    arrow.style.top = (viewportHeight / 2 - sizes.arrow / 2) + 'px';
                    arrow.style.left = '10px';
                    arrow.innerHTML = '👈';
                    gsap.to(arrow, { x: -10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.left > viewportWidth) {
                    arrow.style.top = (viewportHeight / 2 - sizes.arrow / 2) + 'px';
                    arrow.style.left = (viewportWidth - sizes.arrow - 10) + 'px';
                    arrow.innerHTML = '👉';
                    gsap.to(arrow, { x: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                }
            }
        };

        updateArrowPosition();
        state.arrowUpdateInterval = setInterval(updateArrowPosition, 100);
    }

    async function handleCoinClick(subtaskId) {
        if (state.isProcessing) return;

        const clickedCoin = state.coinElements[state.currentCoinIndex];
        const clickedSubtaskId = clickedCoin.getAttribute('data-subtask-id');

        if (clickedSubtaskId !== subtaskId) return;

        debugLog(`Coin clicked: ${subtaskId}`, 'info');
        state.isProcessing = true;

        const coinElements = document.querySelectorAll('.seotize-coin');
        coinElements.forEach(el => el.style.pointerEvents = 'none');

        try {
            if (typeof gsap !== 'undefined') {
                gsap.to(clickedCoin, {
                    scale: 2,
                    opacity: 0,
                    rotation: 360,
                    duration: 0.4,
                    ease: "power2.in"
                });
            }

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

            await new Promise(resolve => setTimeout(resolve, 400));

            // Only show loading on desktop
            if (!state.isMobile) {
                showModernLoading('Verifying', 'Please wait...');
            }

            const token = await getTurnstileToken();
            
            // Only close loading if it was shown (desktop)
            if (!state.isMobile) {
                closeLoading();
            }
            
            const result = await submitTask(subtaskId, token);

            if (result.status === 'success' || result.code === 200) {
                state.completedTasks.push(subtaskId);
                clickedCoin.remove();

                const remainingTasks = state.coinElements.length - (state.currentCoinIndex + 1);

                await Swal.fire({
                    html: `
                        <div class="seotize-success-container">
                            <div class="seotize-success-icon">
                                <div class="seotize-success-circle">
                                    <div class="seotize-checkmark">✓</div>
                                </div>
                            </div>
                            <h2 class="seotize-success-title">Diamond Collected!</h2>
                            <p class="seotize-success-text">Great work! Keep going</p>
                            <div class="seotize-progress-container">
                                <div class="seotize-progress-label">
                                    <span class="seotize-completed">${state.completedTasks.length}</span>
                                    <span class="seotize-divider">/</span>
                                    <span class="seotize-total">${state.coinElements.length}</span>
                                    <span class="seotize-tasks-text">Complete</span>
                                </div>
                                <div class="seotize-progress-bar">
                                    <div class="seotize-progress-fill" style="width: ${(state.completedTasks.length / state.coinElements.length) * 100}%"></div>
                                </div>
                            </div>
                            ${remainingTasks > 0 ? `<p class="seotize-remaining">${remainingTasks} more to go!</p>` : ''}
                        </div>
                    `,
                    timer: CONFIG.TIMING.SUCCESS_DURATION,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    background: 'transparent',
                    backdrop: 'rgba(0, 0, 0, 0.85)',
                    customClass: {
                        popup: 'seotize-success-popup'
                    },
                    didOpen: (popup) => {
                        const circle = popup.querySelector('.seotize-success-circle');
                        if (typeof gsap !== 'undefined') {
                            gsap.from(circle, { scale: 0, duration: 0.3, ease: 'back.out(2)' });
                        }
                    }
                });

                const allTasksComplete = result.data?.all_tasks_complete;

                if (state.currentCoinIndex < state.coinElements.length - 1 && !allTasksComplete) {
                    displayNextCoin();
                    state.isProcessing = false;
                    coinElements.forEach(el => el.style.pointerEvents = 'auto');
                } else {
                    await Swal.fire({
                        html: `
                            <div class="seotize-completion-container">
                                <div class="seotize-celebration-icon">
                                    <div class="seotize-trophy">🏆</div>
                                </div>
                                <h2 class="seotize-completion-title">Congratulations!</h2>
                                <p class="seotize-completion-subtitle">You collected all diamonds!</p>
                                <div class="seotize-completion-stats">
                                    <div class="seotize-stat">
                                        <div class="seotize-stat-value">${state.coinElements.length}</div>
                                        <div class="seotize-stat-label">Diamonds</div>
                                    </div>
                                </div>
                                <p class="seotize-completion-message">Redirecting to dashboard...</p>
                            </div>
                        `,
                        timer: CONFIG.TIMING.COMPLETION_DURATION,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        background: 'transparent',
                        backdrop: 'rgba(0, 0, 0, 0.9)',
                        customClass: {
                            popup: 'seotize-completion-popup'
                        }
                    });
                    
                    window.location.href = 'https://seotize.net/partner/dashboard';
                }
            } else {
                throw new Error(result.data?.message || 'Task failed');
            }
        } catch (error) {
            closeLoading();
            debugLog(`Error: ${error.message}`, 'error');
            Swal.fire({
                html: `
                    <div class="seotize-error-container">
                        <div class="seotize-error-icon">⚠️</div>
                        <h2 class="seotize-error-title">Something went wrong</h2>
                        <p class="seotize-error-message">${error.message || 'Please try again'}</p>
                        <button class="seotize-error-button" onclick="Swal.close()">OK</button>
                    </div>
                `,
                showConfirmButton: false,
                allowOutsideClick: true,
                background: 'transparent',
                backdrop: 'rgba(0, 0, 0, 0.85)',
                customClass: {
                    popup: 'seotize-error-popup'
                }
            });
        } finally {
            state.isProcessing = false;
            coinElements.forEach(el => el.style.pointerEvents = 'auto');
        }
    }

    function showModernLoading(title = 'Processing', message = '') {
        if (typeof Swal === 'undefined') return;

        Swal.fire({
            html: `
                <div class="seotize-modern-loader">
                    <div class="seotize-spinner"></div>
                    <div class="seotize-loader-title">${title}</div>
                    ${message ? `<div class="seotize-loader-message">${message}</div>` : ''}
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            background: 'transparent',
            backdrop: 'rgba(0, 0, 0, 0.85)',
            customClass: {
                popup: 'seotize-loader-popup'
            }
        });
    }

    function closeLoading() {
        if (typeof Swal !== 'undefined') {
            Swal.close();
        }
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            * {
                -webkit-tap-highlight-color: transparent;
            }

            .seotize-coin {
                filter: drop-shadow(0 0 clamp(8px, 2vw, 12px) rgba(99, 102, 241, 0.4));
                will-change: transform;
                transform: translateZ(0);
                transition: transform 0.2s;
            }

            .seotize-coin:active {
                transform: scale(1.3) !important;
            }

            .seotize-arrow {
                will-change: transform;
                filter: drop-shadow(0 0 clamp(6px, 1.5vw, 8px) rgba(255, 215, 0, 0.6));
                transform: translateZ(0);
            }

            .cf-turnstile {
                position: fixed !important;
                top: -9999px !important;
                left: -9999px !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                width: 0 !important;
                height: 0 !important;
            }

            .seotize-loader-popup, .seotize-captcha-popup, .seotize-success-popup, 
            .seotize-completion-popup, .seotize-error-popup, .seotize-welcome-popup {
                padding: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
                border: none !important;
            }

            .seotize-modern-loader {
                padding: clamp(1.5rem, 5vw, 2rem) clamp(1rem, 4vw, 1.5rem);
                text-align: center;
            }

            .seotize-spinner {
                width: clamp(40px, 10vw, 50px);
                height: clamp(40px, 10vw, 50px);
                margin: 0 auto 1rem;
                border: 3px solid rgba(99, 102, 241, 0.2);
                border-top-color: #6366f1;
                border-radius: 50%;
                animation: seotize-spin 0.7s linear infinite;
            }

            @keyframes seotize-spin {
                to { transform: rotate(360deg); }
            }

            .seotize-loader-title {
                font-size: clamp(1.2rem, 4vw, 1.3rem);
                font-weight: 700;
                color: #fff;
                margin-bottom: 0.3rem;
            }

            .seotize-loader-message {
                font-size: clamp(0.85rem, 3vw, 0.9rem);
                color: rgba(255, 255, 255, 0.7);
            }

            .seotize-success-container, .seotize-completion-container, .seotize-error-container, .seotize-welcome-container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: clamp(1.5rem, 5vw, 2rem) clamp(1.2rem, 4vw, 1.5rem);
                border-radius: clamp(12px, 3vw, 16px);
                text-align: center;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.25);
                max-width: 90vw;
                width: clamp(300px, 90vw, 380px);
                margin: 0 auto;
            }

            .seotize-completion-container {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }

            .seotize-error-container {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }

            .seotize-success-icon, .seotize-celebration-icon {
                margin-bottom: 1rem;
            }

            .seotize-success-circle {
                width: clamp(60px, 15vw, 70px);
                height: clamp(60px, 15vw, 70px);
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto;
            }

            .seotize-checkmark {
                font-size: clamp(2rem, 6vw, 2.2rem);
                color: #fff;
                font-weight: bold;
            }

            .seotize-trophy {
                font-size: clamp(3rem, 8vw, 3.5rem);
            }

            .seotize-error-icon {
                font-size: clamp(2.5rem, 7vw, 3rem);
                margin-bottom: 0.8rem;
            }

            .seotize-success-title, .seotize-completion-title, .seotize-error-title, .seotize-welcome-title {
                font-size: clamp(1.4rem, 4vw, 1.6rem);
                font-weight: 900;
                color: #fff;
                margin: 0 0 0.4rem 0;
            }

            .seotize-success-text, .seotize-completion-subtitle, .seotize-error-message, .seotize-welcome-text {
                font-size: clamp(0.9rem, 3vw, 0.95rem);
                color: rgba(255, 255, 255, 0.9);
                margin: 0 0 1.2rem 0;
                line-height: 1.4;
            }

            .seotize-progress-container {
                background: rgba(255, 255, 255, 0.15);
                padding: clamp(0.8rem, 3vw, 1rem);
                border-radius: clamp(8px, 2vw, 10px);
                margin-bottom: 0.8rem;
            }

            .seotize-progress-label {
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: 0.3rem;
                margin-bottom: 0.6rem;
                font-weight: 700;
                color: #fff;
            }

            .seotize-completed {
                color: #10b981;
                font-size: clamp(1.6rem, 5vw, 1.8rem);
            }

            .seotize-divider {
                font-size: clamp(1.2rem, 4vw, 1.3rem);
                color: rgba(255, 255, 255, 0.5);
            }

            .seotize-total {
                font-size: clamp(1.2rem, 4vw, 1.3rem);
                color: rgba(255, 255, 255, 0.8);
            }

            .seotize-tasks-text {
                font-size: clamp(0.75rem, 2vw, 0.8rem);
                color: rgba(255, 255, 255, 0.7);
                margin-left: 0.2rem;
            }

            .seotize-progress-bar {
                width: 100%;
                height: clamp(6px, 2vw, 8px);
                background: rgba(0, 0, 0, 0.2);
                border-radius: clamp(3px, 1vw, 4px);
                overflow: hidden;
            }

            .seotize-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
                border-radius: clamp(3px, 1vw, 4px);
                transition: width 0.6s ease;
            }

            .seotize-remaining, .seotize-completion-message {
                font-size: clamp(0.9rem, 3vw, 0.95rem);
                color: #fff;
                margin: 0;
                font-weight: 500;
            }

            .seotize-completion-stats {
                margin-bottom: 1.2rem;
            }

            .seotize-stat {
                background: rgba(255, 255, 255, 0.15);
                padding: clamp(0.8rem, 3vw, 1rem) clamp(1.5rem, 5vw, 2rem);
                border-radius: clamp(8px, 2vw, 10px);
                display: inline-block;
            }

            .seotize-stat-value {
                font-size: clamp(2rem, 6vw, 2.2rem);
                font-weight: 900;
                color: #fff;
                line-height: 1;
                margin-bottom: 0.2rem;
            }

            .seotize-stat-label {
                font-size: clamp(0.75rem, 2vw, 0.8rem);
                color: rgba(255, 255, 255, 0.8);
                font-weight: 600;
            }

            .seotize-error-button {
                background: #fff;
                color: #f5576c;
                border: none;
                padding: clamp(0.5rem, 2vw, 0.6rem) clamp(1.5rem, 4vw, 1.8rem);
                border-radius: clamp(6px, 2vw, 8px);
                font-size: clamp(0.9rem, 3vw, 0.95rem);
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .seotize-error-button:active {
                transform: scale(0.95);
            }

            .seotize-welcome-icon {
                font-size: clamp(3rem, 8vw, 3.5rem);
                margin-bottom: 0.8rem;
            }

            .seotize-welcome-features {
                background: rgba(255, 255, 255, 0.15);
                padding: clamp(0.8rem, 3vw, 1rem);
                border-radius: clamp(8px, 2vw, 10px);
                margin-bottom: 0.8rem;
                text-align: left;
            }

            .seotize-feature {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.6rem;
                color: #fff;
                font-size: clamp(0.85rem, 2.5vw, 0.9rem);
            }

            .seotize-feature:last-child {
                margin-bottom: 0;
            }

            .seotize-feature-icon {
                font-size: clamp(1.1rem, 3vw, 1.2rem);
                flex-shrink: 0;
            }

            .seotize-countdown {
                font-size: clamp(0.75rem, 2vw, 0.8rem);
                color: rgba(255, 255, 255, 0.7);
            }

            /* Captcha Modal */
            .seotize-captcha-container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: clamp(1.5rem, 5vw, 2.5rem);
                border-radius: clamp(12px, 3vw, 20px);
                text-align: center;
                max-width: 90vw;
                width: clamp(300px, 90vw, 450px);
                margin: 0 auto;
            }

            .seotize-captcha-icon {
                font-size: clamp(2.5rem, 8vw, 3rem);
                margin-bottom: 0.5rem;
            }

            .seotize-captcha-title {
                font-size: clamp(1.3rem, 4vw, 1.6rem);
                font-weight: 800;
                color: #fff;
                margin: 0.5rem 0;
            }

            .seotize-captcha-text {
                font-size: clamp(0.85rem, 3vw, 0.95rem);
                color: rgba(255, 255, 255, 0.9);
                margin-bottom: 1.2rem;
            }

            #seotize-captcha-widget {
                display: flex;
                justify-content: center;
                margin: 0 auto;
            }

            .swal2-timer-progress-bar {
                background: rgba(255, 255, 255, 0.3) !important;
                height: 2px !important;
            }

            /* Very small screens */
            @media (max-width: 360px) {
                .seotize-captcha-container {
                    padding: 1.2rem 0.8rem;
                }
                
                #seotize-captcha-widget iframe {
                    transform: scale(0.85);
                    transform-origin: center;
                }
            }
        `;
        domCache.head.appendChild(style);
    }

    async function initializeEngine() {
        try {
            await waitForDependencies();

            state.uniqueId = getUniqueId();
            debugLog(`Unique ID: ${state.uniqueId}`, 'info');
            debugLog(`Mobile: ${state.isMobile}`, 'info');
            
            const data = await fetchPartnerSubtasks(state.uniqueId, state.systemId);

            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                debugLog('No subtasks available', 'warning');
                return;
            }

            state.coins = data.subtasks_info
                .filter(task => task.status === 'incomplete')
                .map(task => task.subtask_id);

            if (state.coins.length === 0) {
                Swal.fire({
                    html: `
                        <div class="seotize-welcome-container">
                            <div class="seotize-welcome-icon">✅</div>
                            <h2 class="seotize-welcome-title">All Done!</h2>
                            <p class="seotize-welcome-text">You have completed all tasks.</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    background: 'transparent',
                    backdrop: 'rgba(0, 0, 0, 0.85)',
                    customClass: {
                        popup: 'seotize-welcome-popup'
                    }
                });
                return;
            }

            await Swal.fire({
                html: `
                    <div class="seotize-welcome-container">
                        <div class="seotize-welcome-icon">💎</div>
                        <h2 class="seotize-welcome-title">Welcome Partner!</h2>
                        <p class="seotize-welcome-text">Get ready to collect diamonds and earn your reward</p>
                        <div class="seotize-welcome-features">
                            <div class="seotize-feature">
                                <span class="seotize-feature-icon">🎯</span>
                                <span>Follow the arrow</span>
                            </div>
                            <div class="seotize-feature">
                                <span class="seotize-feature-icon">💎</span>
                                <span>Click each diamond</span>
                            </div>
                            <div class="seotize-feature">
                                <span class="seotize-feature-icon">🏆</span>
                                <span>Collect all ${state.coins.length} to win</span>
                            </div>
                        </div>
                        <p class="seotize-countdown">Starting soon...</p>
                    </div>
                `,
                timer: CONFIG.TIMING.WELCOME_DURATION,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false,
                background: 'transparent',
                backdrop: 'rgba(0, 0, 0, 0.85)',
                customClass: {
                    popup: 'seotize-welcome-popup'
                }
            });

            renderCoins();
            displayNextCoin();

        } catch (error) {
            console.error('Init error:', error);
            debugLog(`Init error: ${error.message}`, 'error');
        }
    }

    window.onloadTurnstileCallback = function() {
        debugLog('Turnstile script loaded', 'info');
        if (typeof turnstile !== 'undefined') {
            const element = document.querySelector('.cf-turnstile');
            
            if (element) {
                try {
                    state.turnstileWidgetId = turnstile.render(element, {
                        sitekey: state.systemId,
                        theme: 'light',
                        size: 'normal',
                        retry: 'auto',
                        'retry-interval': 8000,
                        'refresh-expired': 'auto',
                        'appearance': 'execute',
                        callback: function(token) {
                            debugLog('✓ Token callback', 'success');
                        }
                    });
                    
                    state.turnstileReady = true;
                    debugLog(`✓ Turnstile initialized (ID: ${state.turnstileWidgetId})`, 'success');
                } catch (error) {
                    debugLog(`✗ Turnstile init error: ${error.message}`, 'error');
                }
            }
        }
    };

    window.onTurnstileCallback = function(token) {
        // Callback placeholder
    };

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
            debugLog('No system ID', 'error');
            return;
        }

        debugLog(`System ID: ${state.systemId}`, 'info');
        window.SYSYID = state.systemId;

        if (!document.referrer.includes('google.com')) {
            debugLog('Referrer check failed', 'warning');
            return;
        }

        debugLog('Starting initialization', 'info');
        injectStyles();

        const loaded = await loadDependencies();
        if (!loaded) return;

        setupTurnstile();
        initializeEngine();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
