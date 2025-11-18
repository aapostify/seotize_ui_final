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
            WELCOME_DURATION: 6000,
            SUCCESS_DURATION: 2000,
            COMPLETION_DURATION: 2500,
            POLL_INTERVAL: 50,
            TURNSTILE_READY_TIMEOUT: 20000,
            TURNSTILE_TOKEN_TIMEOUT: 60000,
            CAPTCHA_SHOW_DURATION: 1200, // Show "Verifying" for 1.2s
            CAPTCHA_VERIFIED_DURATION: 600 // Show "Verified" for 0.6s
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
        tasksData: null,
        debugLogs: [],
        turnstileTokenCache: null,
        lastTokenTime: 0
    };

    let domCache = null;
    let debugContainer = null;

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
        var userAgent = navigator.userAgent;
        var language = navigator.language;
        var platform = navigator.platform;
        var screenResolution = screen.width + 'x' + screen.height;
        var combinedData = `${userAgent}|${language}|${platform}|${screenResolution}`;
        return combinedData;
    }

    function hashData(data) {
        return CryptoJS.MD5(data).toString();
    }

    function getUniqueId() {
        var browserData = getBrowserData();
        return hashData(browserData);
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

    // OPTIMIZED: Much faster verification screen
    async function showCaptchaVerification() {
        if (typeof Swal === 'undefined') return;

        return new Promise((resolve) => {
            Swal.fire({
                html: `
                    <div class="seotize-captcha-verification">
                        <div class="seotize-shield-container">
                            <div class="seotize-shield" id="seotize-shield-icon">🛡️</div>
                            <div class="seotize-shield-check" id="seotize-shield-check">✓</div>
                        </div>
                        <div class="seotize-captcha-title" id="seotize-captcha-title">Verifying</div>
                        <div class="seotize-captcha-dots">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                `,
                allowOutsideClick: false,
                showConfirmButton: false,
                background: 'transparent',
                backdrop: 'rgba(0, 0, 0, 0.85)',
                customClass: {
                    popup: 'seotize-captcha-popup'
                },
                didOpen: () => {
                    // Show verifying state for 1.2 seconds
                    setTimeout(() => {
                        const shieldIcon = document.getElementById('seotize-shield-icon');
                        const shieldCheck = document.getElementById('seotize-shield-check');
                        const title = document.getElementById('seotize-captcha-title');
                        const dots = document.querySelector('.seotize-captcha-dots');
                        
                        if (shieldIcon && shieldCheck && title && dots) {
                            // Quick transition to verified state
                            shieldIcon.style.opacity = '0';
                            shieldIcon.style.transform = 'scale(0)';
                            dots.style.opacity = '0';
                            
                            setTimeout(() => {
                                shieldCheck.style.opacity = '1';
                                shieldCheck.style.transform = 'scale(1)';
                                title.textContent = 'Verified ✓';
                            }, 200);
                        }
                        
                        // Resolve quickly after showing verified state
                        setTimeout(() => {
                            resolve();
                        }, CONFIG.TIMING.CAPTCHA_VERIFIED_DURATION);
                    }, CONFIG.TIMING.CAPTCHA_SHOW_DURATION);
                }
            });
        });
    }

    function closeLoading() {
        if (typeof Swal !== 'undefined') {
            Swal.close();
        }
    }

    function resetTurnstile() {
        debugLog('Resetting Turnstile widget', 'info');
        if (typeof turnstile !== 'undefined' && state.turnstileWidgetId !== null) {
            try {
                turnstile.reset(state.turnstileWidgetId);
                state.turnstileTokenCache = null;
                state.lastTokenTime = 0;
                debugLog('✓ Turnstile reset successful', 'success');
            } catch (error) {
                debugLog(`✗ Turnstile reset error: ${error.message}`, 'error');
                console.error('Error resetting Turnstile:', error);
            }
        } else {
            debugLog('⚠ Turnstile not available for reset', 'warning');
        }
    }

    async function waitForTurnstileReady() {
        debugLog('Waiting for Turnstile to be ready...', 'info');
        
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let lastLogTime = startTime;
            
            const checkReady = () => {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                
                if (Date.now() - lastLogTime > 3000) {
                    debugLog(`Waiting for Turnstile ready... (${elapsed}s)`, 'info');
                    lastLogTime = Date.now();
                }
                
                if (state.turnstileReady && state.turnstileWidgetId !== null) {
                    debugLog(`✓ Turnstile ready (${elapsed}s)`, 'success');
                    resolve();
                    return;
                }
                
                setTimeout(checkReady, CONFIG.TIMING.POLL_INTERVAL);
            };
            
            checkReady();
            
            setTimeout(() => {
                debugLog('✗ Turnstile ready timeout', 'error');
                reject(new Error('Turnstile ready timeout'));
            }, CONFIG.TIMING.TURNSTILE_READY_TIMEOUT);
        });
    }

    async function waitForTurnstileToken(resetFirst = false, retryCount = 0) {
        const MAX_RETRIES = 2;
        const TOKEN_CACHE_DURATION = 110000;
        
        debugLog(`Waiting for Turnstile token (reset: ${resetFirst}, retry: ${retryCount}/${MAX_RETRIES})`, 'info');
        
        try {
            if (!state.turnstileReady || state.turnstileWidgetId === null) {
                debugLog('⚠ Turnstile not ready, waiting...', 'warning');
                await waitForTurnstileReady();
            }
            
            const tokenAge = Date.now() - state.lastTokenTime;
            if (!resetFirst && state.turnstileTokenCache && tokenAge < TOKEN_CACHE_DURATION) {
                debugLog(`✓ Using cached token (age: ${(tokenAge/1000).toFixed(1)}s)`, 'success');
                return state.turnstileTokenCache;
            }
            
            if (resetFirst) {
                resetTurnstile();
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                
                const checkToken = () => {
                    const responseElement = document.getElementsByName('cf-turnstile-response')[0];
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

                    if (responseElement?.value) {
                        const token = responseElement.value;
                        state.turnstileTokenCache = token;
                        state.lastTokenTime = Date.now();
                        debugLog(`✓ Token received (${elapsed}s)`, 'success');
                        resolve(token);
                        return;
                    }

                    if (state.turnstileTokenCache && (Date.now() - state.lastTokenTime < 2000)) {
                        debugLog(`✓ Using cached token`, 'success');
                        resolve(state.turnstileTokenCache);
                        return;
                    }

                    setTimeout(checkToken, CONFIG.TIMING.POLL_INTERVAL);
                };

                checkToken();

                setTimeout(() => {
                    debugLog(`✗ Token timeout - Retry ${retryCount}/${MAX_RETRIES}`, 'error');
                    reject(new Error('Turnstile timeout'));
                }, CONFIG.TIMING.TURNSTILE_TOKEN_TIMEOUT);
            });
            
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                debugLog(`Retrying... (attempt ${retryCount + 1})`, 'warning');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return waitForTurnstileToken(true, retryCount + 1);
            }
            throw error;
        }
    }

    async function fetchPartnerSubtasks(uniqueId, siteKey) {
        debugLog('Fetching tasks...', 'info');
        
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.GET_TASKS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unique_id: uniqueId,
                    site_key: siteKey
                })
            });

            debugLog(`API Status: ${response.status}`, response.ok ? 'success' : 'error');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            debugLog(`✓ Tasks received`, 'success');
            
            return data;
        } catch (error) {
            debugLog(`✗ API error: ${error.message}`, 'error');
            throw error;
        }
    }

    async function submitTask(subtaskId, turnstileToken) {
        debugLog(`Submitting task...`, 'info');
        
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.DO_TASK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unique_id: state.uniqueId,
                    'cf-turnstile-response': turnstileToken,
                    sub_task_id: subtaskId
                })
            });

            debugLog(`Submit status: ${response.status}`, response.ok ? 'success' : 'error');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            debugLog(`✓ Task submitted`, 'success');
            
            return result;
        } catch (error) {
            debugLog(`✗ Submit error: ${error.message}`, 'error');
            throw error;
        }
    }

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
            textShadow: '0 0 20px rgba(99, 102, 241, 0.8)',
            transition: 'transform 0.2s ease',
            userSelect: 'none',
            willChange: 'transform'
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
            const y = sectionStart + (sectionEnd - sectionStart) * 0.5 + (Math.random() - 0.5) * (sectionHeight * variance);
            const x = Math.random() * (viewportWidth - coinSize - (margin * 2)) + margin;

            positions.push({ x, y });
        }

        return positions;
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
                duration: 0.6,
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

        const arrow = document.createElement('div');
        arrow.className = 'seotize-arrow';
        arrow.innerHTML = '👇';

        Object.assign(arrow.style, {
            position: 'fixed',
            fontSize: `${CONFIG.ARROW.SIZE}px`,
            pointerEvents: 'none',
            zIndex: '999998',
            textShadow: '0 0 15px rgba(255, 215, 0, 0.8)',
            userSelect: 'none',
            willChange: 'transform'
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
            const arrowWidth = CONFIG.ARROW.SIZE;
            const arrowHeight = CONFIG.ARROW.SIZE;

            const isVisible = rect.top >= 0 && rect.bottom <= viewportHeight && rect.left >= 0 && rect.right <= viewportWidth;

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
                    arrow.style.top = '10px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👆';
                    gsap.to(arrow, { y: -10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.top > viewportHeight) {
                    arrow.style.top = (viewportHeight - arrowHeight - 10) + 'px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👇';
                    gsap.to(arrow, { y: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.right < 0) {
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = '10px';
                    arrow.innerHTML = '👈';
                    gsap.to(arrow, { x: -10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else if (rect.left > viewportWidth) {
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = (viewportWidth - arrowWidth - 10) + 'px';
                    arrow.innerHTML = '👉';
                    gsap.to(arrow, { x: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                }
            }
        };

        updateArrowPosition();
        state.arrowUpdateInterval = setInterval(updateArrowPosition, CONFIG.ARROW.UPDATE_INTERVAL);
    }

    async function handleCoinClick(subtaskId) {
        if (state.isProcessing) return;

        const clickedCoin = state.coinElements[state.currentCoinIndex];
        const clickedSubtaskId = clickedCoin.getAttribute('data-subtask-id');

        if (clickedSubtaskId !== subtaskId) return;

        state.isProcessing = true;

        const coinElements = document.querySelectorAll('.seotize-coin');
        coinElements.forEach(el => el.style.pointerEvents = 'none');

        try {
            if (typeof gsap !== 'undefined') {
                gsap.to(clickedCoin, {
                    scale: 2,
                    opacity: 0,
                    rotation: 360,
                    duration: 0.5,
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

            await new Promise(resolve => setTimeout(resolve, 500));

            // Show quick verification screen (total: ~1.8s)
            await showCaptchaVerification();

            const token = await waitForTurnstileToken(true);
            
            closeLoading();
            showModernLoading('Submitting', 'Please wait');
            
            const result = await submitTask(subtaskId, token);

            closeLoading();

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
                            gsap.from(circle, { scale: 0, duration: 0.4, ease: 'back.out(2)' });
                        }
                    }
                });

                const allTasksComplete = result.data?.all_tasks_complete;

                if (state.currentCoinIndex < state.coinElements.length - 1 && !allTasksComplete) {
                    displayNextCoin();
                    state.isProcessing = false;
                    const coinElements = document.querySelectorAll('.seotize-coin');
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
            const coinElements = document.querySelectorAll('.seotize-coin');
            coinElements.forEach(el => el.style.pointerEvents = 'auto');
        }
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .seotize-coin {
                filter: drop-shadow(0 0 15px rgba(99, 102, 241, 0.5));
                will-change: transform;
            }

            .seotize-coin:hover {
                transform: scale(1.2) !important;
            }

            .seotize-arrow {
                will-change: transform;
                filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.7));
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
                padding: 2.5rem 2rem;
                text-align: center;
            }

            .seotize-spinner {
                width: 60px;
                height: 60px;
                margin: 0 auto 1.5rem;
                border: 4px solid rgba(99, 102, 241, 0.2);
                border-top-color: #6366f1;
                border-radius: 50%;
                animation: seotize-spin 0.8s linear infinite;
            }

            @keyframes seotize-spin {
                to { transform: rotate(360deg); }
            }

            .seotize-loader-title {
                font-size: 1.4rem;
                font-weight: 700;
                color: #fff;
                margin-bottom: 0.5rem;
            }

            .seotize-loader-message {
                font-size: 0.95rem;
                color: rgba(255, 255, 255, 0.7);
            }

            .seotize-captcha-verification {
                padding: 2.5rem 2rem;
                text-align: center;
            }

            .seotize-shield-container {
                margin: 0 auto 1.5rem;
                position: relative;
                width: 100px;
                height: 100px;
            }

            .seotize-shield {
                font-size: 4rem;
                animation: seotize-pulse 2s ease-in-out infinite;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }

            .seotize-shield-check {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0);
                font-size: 4rem;
                color: #10b981;
                opacity: 0;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }

            @keyframes seotize-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .seotize-captcha-title {
                font-size: 1.5rem;
                font-weight: 700;
                color: #fff;
                margin-bottom: 1rem;
                transition: all 0.2s ease;
            }

            .seotize-captcha-dots {
                display: flex;
                justify-content: center;
                gap: 8px;
                transition: opacity 0.2s ease;
            }

            .seotize-captcha-dots span {
                width: 8px;
                height: 8px;
                background: #6366f1;
                border-radius: 50%;
                animation: seotize-dot-bounce 1.4s infinite ease-in-out both;
            }

            .seotize-captcha-dots span:nth-child(1) { animation-delay: -0.32s; }
            .seotize-captcha-dots span:nth-child(2) { animation-delay: -0.16s; }

            @keyframes seotize-dot-bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }

            .seotize-success-container, .seotize-completion-container, .seotize-error-container, .seotize-welcome-container {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 2.5rem 2rem;
                border-radius: 20px;
                text-align: center;
                box-shadow: 0 15px 40px rgba(102, 126, 234, 0.3);
                max-width: 90vw;
                width: 400px;
                margin: 0 auto;
            }

            .seotize-completion-container {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }

            .seotize-error-container {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }

            .seotize-success-icon, .seotize-celebration-icon {
                margin-bottom: 1.5rem;
            }

            .seotize-success-circle {
                width: 80px;
                height: 80px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto;
            }

            .seotize-checkmark {
                font-size: 2.5rem;
                color: #fff;
                font-weight: bold;
            }

            .seotize-trophy {
                font-size: 4rem;
            }

            .seotize-error-icon {
                font-size: 3.5rem;
                margin-bottom: 1rem;
            }

            .seotize-success-title, .seotize-completion-title, .seotize-error-title, .seotize-welcome-title {
                font-size: 1.8rem;
                font-weight: 900;
                color: #fff;
                margin: 0 0 0.5rem 0;
            }

            .seotize-success-text, .seotize-completion-subtitle, .seotize-error-message, .seotize-welcome-text {
                font-size: 1rem;
                color: rgba(255, 255, 255, 0.9);
                margin: 0 0 1.5rem 0;
                line-height: 1.5;
            }

            .seotize-progress-container {
                background: rgba(255, 255, 255, 0.15);
                padding: 1.2rem;
                border-radius: 12px;
                margin-bottom: 1rem;
            }

            .seotize-progress-label {
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: 0.3rem;
                margin-bottom: 0.8rem;
                font-weight: 700;
                color: #fff;
            }

            .seotize-completed {
                color: #10b981;
                font-size: 2rem;
            }

            .seotize-divider {
                font-size: 1.5rem;
                color: rgba(255, 255, 255, 0.5);
            }

            .seotize-total {
                font-size: 1.5rem;
                color: rgba(255, 255, 255, 0.8);
            }

            .seotize-tasks-text {
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.7);
                margin-left: 0.3rem;
            }

            .seotize-progress-bar {
                width: 100%;
                height: 10px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 5px;
                overflow: hidden;
            }

            .seotize-progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
                border-radius: 5px;
                transition: width 0.8s ease;
            }

            .seotize-remaining, .seotize-completion-message {
                font-size: 1rem;
                color: #fff;
                margin: 0;
                font-weight: 500;
            }

            .seotize-completion-stats {
                margin-bottom: 1.5rem;
            }

            .seotize-stat {
                background: rgba(255, 255, 255, 0.15);
                padding: 1.2rem 2.5rem;
                border-radius: 12px;
                display: inline-block;
            }

            .seotize-stat-value {
                font-size: 2.5rem;
                font-weight: 900;
                color: #fff;
                line-height: 1;
                margin-bottom: 0.3rem;
            }

            .seotize-stat-label {
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.8);
                font-weight: 600;
            }

            .seotize-error-button {
                background: #fff;
                color: #f5576c;
                border: none;
                padding: 0.7rem 2rem;
                border-radius: 10px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .seotize-error-button:hover {
                transform: scale(1.05);
            }

            .seotize-welcome-icon {
                font-size: 4rem;
                margin-bottom: 1rem;
            }

            .seotize-welcome-features {
                background: rgba(255, 255, 255, 0.15);
                padding: 1.2rem;
                border-radius: 12px;
                margin-bottom: 1rem;
                text-align: left;
            }

            .seotize-feature {
                display: flex;
                align-items: center;
                gap: 0.6rem;
                margin-bottom: 0.8rem;
                color: #fff;
                font-size: 0.95rem;
            }

            .seotize-feature:last-child {
                margin-bottom: 0;
            }

            .seotize-feature-icon {
                font-size: 1.3rem;
                flex-shrink: 0;
            }

            .seotize-countdown {
                font-size: 0.85rem;
                color: rgba(255, 255, 255, 0.7);
            }

            .swal2-timer-progress-bar {
                background: rgba(255, 255, 255, 0.3) !important;
                height: 3px !important;
            }

            @media (max-width: 480px) {
                .seotize-success-container, .seotize-completion-container, 
                .seotize-error-container, .seotize-welcome-container {
                    padding: 2rem 1.5rem;
                    width: 95vw;
                }
                
                .seotize-success-title, .seotize-completion-title, 
                .seotize-error-title, .seotize-welcome-title {
                    font-size: 1.5rem;
                }
                
                .seotize-completed {
                    font-size: 1.8rem;
                }
                
                .seotize-total, .seotize-divider {
                    font-size: 1.3rem;
                }
                
                .seotize-stat-value {
                    font-size: 2rem;
                }
            }
        `;
        domCache.head.appendChild(style);
    }

    async function waitForDependencies() {
        return new Promise((resolve) => {
            const checkDeps = () => {
                if (typeof CryptoJS !== 'undefined' &&
                    typeof Swal !== 'undefined' &&
                    typeof gsap !== 'undefined') {
                    state.dependenciesLoaded = true;
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
            await waitForDependencies();

            state.uniqueId = getUniqueId();
            
            const data = await fetchPartnerSubtasks(state.uniqueId, state.systemId);

            if (!data.subtasks_info || data.subtasks_info.length === 0) {
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
        }
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

    async function loadDependencies() {
        try {
            const scriptPromises = [
                loadScript(CONFIG.CDN.CRYPTO),
                loadScript(CONFIG.CDN.SWEETALERT),
                loadScript(CONFIG.CDN.GSAP),
                loadScript(CONFIG.CDN.TURNSTILE, true)
            ];

            await Promise.all(scriptPromises);
            return true;
        } catch (error) {
            console.error('Dependency load error:', error);
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
            return;
        }

        const queryString = engineScript.src.split('?')[1];
        state.systemId = getURLParameter(queryString, 'id');

        if (!state.systemId) {
            return;
        }

        window.SYSYID = state.systemId;

        if (!document.referrer.includes('google.com')) {
            return;
        }

        injectStyles();

        const loaded = await loadDependencies();
        if (!loaded) {
            return;
        }

        setupTurnstile();
        initializeEngine();
    }

    window.onloadTurnstileCallback = function() {
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
                            state.turnstileTokenCache = token;
                            state.lastTokenTime = Date.now();
                        },
                        'error-callback': function() {
                            state.turnstileTokenCache = null;
                        },
                        'expired-callback': function() {
                            state.turnstileTokenCache = null;
                        },
                        'timeout-callback': function() {
                            state.turnstileTokenCache = null;
                        }
                    });
                    
                    state.turnstileReady = true;
                } catch (error) {
                    console.error('Turnstile error:', error);
                }
            }
        }
    };

    window.onTurnstileCallback = function(token) {
        debugLog(`Token received`, 'info');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
