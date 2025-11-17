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
            SUCCESS_DURATION: 1500,
            COMPLETION_DURATION: 2000,
            POLL_INTERVAL: 50,
            TURNSTILE_READY_TIMEOUT: 20000,
            TURNSTILE_TOKEN_TIMEOUT: 60000 // Increased to 60s to account for slow mobile
        },
        DEBUG: {
            ENABLED: true, // Set to false to disable debug mode
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
        lastTokenTime: 0,
        isInitialToken: true // Track if this is the first token
    };

    let domCache = null;
    let debugContainer = null;

    // Debug Logger
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

    function showLoading(title = 'Loading...') {
        if (typeof Swal === 'undefined') return;

        Swal.fire({
            title,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
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
                    debugLog(`turnstileReady: ${state.turnstileReady}, widgetId: ${state.turnstileWidgetId}`, 'info');
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
                debugLog(`Final state - ready: ${state.turnstileReady}, widgetId: ${state.turnstileWidgetId}`, 'error');
                debugLog(`typeof turnstile: ${typeof turnstile}`, 'error');
                reject(new Error('Turnstile ready timeout'));
            }, CONFIG.TIMING.TURNSTILE_READY_TIMEOUT);
        });
    }

    // FIXED: Don't reset on initial token request
    async function waitForTurnstileToken(resetFirst = false, retryCount = 0) {
        const MAX_RETRIES = 2;
        const TOKEN_CACHE_DURATION = 110000;
        
        debugLog(`Waiting for Turnstile token (reset: ${resetFirst}, retry: ${retryCount}/${MAX_RETRIES})`, 'info');
        
        try {
            if (!state.turnstileReady || state.turnstileWidgetId === null) {
                debugLog('⚠ Turnstile not ready, waiting for initialization...', 'warning');
                await waitForTurnstileReady();
            }
            
            // Check cached token
            const tokenAge = Date.now() - state.lastTokenTime;
            if (!resetFirst && state.turnstileTokenCache && tokenAge < TOKEN_CACHE_DURATION) {
                debugLog(`✓ Using cached token (age: ${(tokenAge/1000).toFixed(1)}s)`, 'success');
                return state.turnstileTokenCache;
            }
            
            // CRITICAL FIX: Don't reset on initial load, let the auto-generated token come through
            if (resetFirst && !state.isInitialToken) {
                resetTurnstile();
                await new Promise(resolve => setTimeout(resolve, 200));
            } else if (state.isInitialToken) {
                debugLog('⏳ Waiting for initial auto-generated token (no reset)', 'info');
            }

            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                let lastLogTime = startTime;
                
                const checkToken = () => {
                    const responseElement = document.getElementsByName('cf-turnstile-response')[0];
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    
                    if (Date.now() - lastLogTime > 3000) {
                        debugLog(`Still waiting for token... (${elapsed}s)`, 'info');
                        lastLogTime = Date.now();
                    }

                    if (responseElement?.value) {
                        const token = responseElement.value;
                        state.turnstileTokenCache = token;
                        state.lastTokenTime = Date.now();
                        state.isInitialToken = false; // Mark that we got the initial token
                        debugLog(`✓ Turnstile token received (${elapsed}s)`, 'success');
                        resolve(token);
                        return;
                    }

                    // Also check cache in case callback already set it
                    if (state.turnstileTokenCache && (Date.now() - state.lastTokenTime < 2000)) {
                        debugLog(`✓ Using token from cache (callback received)`, 'success');
                        state.isInitialToken = false;
                        resolve(state.turnstileTokenCache);
                        return;
                    }

                    if (!responseElement) {
                        const observer = new MutationObserver(() => {
                            const elem = document.getElementsByName('cf-turnstile-response')[0];
                            if (elem) {
                                debugLog('✓ Turnstile element detected by observer', 'success');
                                observer.disconnect();
                                checkToken();
                            }
                        });

                        observer.observe(domCache.body, {
                            childList: true,
                            subtree: true
                        });
                    } else {
                        setTimeout(checkToken, CONFIG.TIMING.POLL_INTERVAL);
                    }
                };

                checkToken();

                setTimeout(() => {
                    debugLog(`✗ Turnstile timeout (${CONFIG.TIMING.TURNSTILE_TOKEN_TIMEOUT/1000}s) - Retry ${retryCount}/${MAX_RETRIES}`, 'error');
                    debugLog(`Widget ID: ${state.turnstileWidgetId}, Ready: ${state.turnstileReady}`, 'error');
                    reject(new Error('Turnstile timeout'));
                }, CONFIG.TIMING.TURNSTILE_TOKEN_TIMEOUT);
            });
            
        } catch (error) {
            if (retryCount < MAX_RETRIES) {
                debugLog(`Retrying Turnstile token request (attempt ${retryCount + 1})...`, 'warning');
                state.isInitialToken = false; // Force reset on retry
                await new Promise(resolve => setTimeout(resolve, 1000));
                return waitForTurnstileToken(true, retryCount + 1);
            }
            throw error;
        }
    }

    async function fetchPartnerSubtasks(uniqueId, turnstileToken) {
        debugLog('Fetching partner subtasks from API', 'info');
        debugLog(`Unique ID: ${uniqueId.substring(0, 8)}...`, 'info');
        
        try {
            const response = await fetch(CONFIG.API_ENDPOINTS.GET_TASKS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unique_id: uniqueId,
                    'cf-turnstile-response': turnstileToken
                })
            });

            debugLog(`API Response Status: ${response.status}`, response.ok ? 'success' : 'error');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            debugLog(`✓ API returned data: ${JSON.stringify(data).substring(0, 100)}...`, 'success');
            
            return data;
        } catch (error) {
            debugLog(`✗ API fetch error: ${error.message}`, 'error');
            throw error;
        }
    }

    async function submitTask(subtaskId, turnstileToken) {
        debugLog(`Submitting task: ${subtaskId}`, 'info');
        
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

            debugLog(`Task submit status: ${response.status}`, response.ok ? 'success' : 'error');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            debugLog(`✓ Task result: ${result.status || result.code}`, 'success');
            
            return result;
        } catch (error) {
            debugLog(`✗ Task submit error: ${error.message}`, 'error');
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
            userSelect: 'none'
        });

        coin.addEventListener('click', () => handleCoinClick(subtaskId));

        return coin;
    }

    function calculateCoinPositions(count) {
        const positions = [];
        const scrollHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            document.body.clientHeight,
            document.documentElement.clientHeight
        );

        const viewportWidth = window.innerWidth;
        const coinSize = CONFIG.COIN.SIZE;
        const margin = CONFIG.COIN.MIN_MARGIN;
        const sectionHeight = scrollHeight / count;
        const variance = CONFIG.COIN.SECTION_VARIANCE;

        debugLog(`Calculating ${count} coin positions (viewport: ${viewportWidth}x${scrollHeight})`, 'info');

        for (let i = 0; i < count; i++) {
            const sectionStart = i * sectionHeight;
            const sectionEnd = (i + 1) * sectionHeight;
            const y = sectionStart + (sectionEnd - sectionStart) * 0.5 + (Math.random() - 0.5) * (sectionHeight * variance);
            const x = Math.random() * (viewportWidth - coinSize - (margin * 2)) + margin;

            positions.push({ x, y });
        }

        debugLog(`✓ Coin positions calculated`, 'success');
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

        debugLog(`✓ ${state.coinElements.length} coins rendered`, 'success');
    }

    function displayNextCoin() {
        state.currentCoinIndex++;

        if (state.currentCoinIndex >= state.coinElements.length) {
            debugLog('No more coins to display', 'info');
            return;
        }

        debugLog(`Displaying coin ${state.currentCoinIndex + 1}/${state.coinElements.length}`, 'info');

        const coin = state.coinElements[state.currentCoinIndex];
        coin.style.display = 'block';

        if (typeof gsap !== 'undefined') {
            gsap.from(coin, {
                scale: 0,
                opacity: 0,
                duration: 0.8,
                ease: "elastic.out(1, 0.5)"
            });

            gsap.to(coin, {
                scale: 1.2,
                repeat: -1,
                yoyo: true,
                ease: "power1.inOut",
                duration: 1.5
            });

            gsap.to(coin, {
                textShadow: '0 0 30px rgba(99, 102, 241, 1), 0 0 60px rgba(139, 92, 246, 0.8)',
                repeat: -1,
                yoyo: true,
                ease: "power1.inOut",
                duration: 2
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
            const arrowWidth = arrow.offsetWidth || CONFIG.ARROW.SIZE;
            const arrowHeight = arrow.offsetHeight || CONFIG.ARROW.SIZE;

            const isVisible = rect.top >= 0 &&
                               rect.bottom <= viewportHeight &&
                               rect.left >= 0 &&
                               rect.right <= viewportWidth;

            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf(arrow);
            }

            if (isVisible) {
                arrow.style.top = (rect.top - CONFIG.ARROW.OFFSET) + 'px';
                arrow.style.left = (targetX - arrowWidth / 2) + 'px';
                arrow.innerHTML = '👇';
                arrow.style.transform = '';
                
                gsap.to(arrow, {
                    y: 10,
                    repeat: -1,
                    yoyo: true,
                    ease: "power1.inOut",
                    duration: 0.5
                });

            } else {
                arrow.style.opacity = '1';
                arrow.style.transform = 'translateY(0)';

                if (rect.bottom < 0) {
                    arrow.style.top = '10px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👆';
                    gsap.to(arrow, { y: -10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });

                } else if (rect.top > viewportHeight) {
                    arrow.style.top = (viewportHeight - arrowHeight - 10) + 'px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👇';
                    gsap.to(arrow, { y: 10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });

                } else if (rect.right < 0) {
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = '10px';
                    arrow.innerHTML = '👈';
                    gsap.to(arrow, { x: -10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });

                } else if (rect.left > viewportWidth) {
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = (viewportWidth - arrowWidth - 10) + 'px';
                    arrow.innerHTML = '👉';
                    gsap.to(arrow, { x: 10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });
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
                    duration: 0.6,
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

            await new Promise(resolve => setTimeout(resolve, 600));

            showLoading('Submitting task...');

            // Reset Turnstile and get a fresh token for this submission
            const token = await waitForTurnstileToken(true);
            const result = await submitTask(subtaskId, token);

            closeLoading();

            if (result.status === 'success' || result.code === 200) {
                state.completedTasks.push(subtaskId);
                clickedCoin.remove();

                const remainingTasks = state.coinElements.length - (state.currentCoinIndex + 1);
                debugLog(`✓ Task completed! ${remainingTasks} remaining`, 'success');

                await Swal.fire({
                    title: `GOOD JOB, ${remainingTasks} MORE!`,
                    html: `
                        <div class="seotize-gsap-emoji">✅</div>
                        <div class="seotize-html seotize-success">You Have Collected a Diamond! ${remainingTasks} More To Go!</div>
                    `,
                    timer: CONFIG.TIMING.SUCCESS_DURATION,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    customClass: {
                        popup: 'seotize-popup',
                        title: 'seotize-title'
                    },
                    didOpen: (popup) => {
                        const emoji = popup.querySelector('.seotize-gsap-emoji');
                        gsap.from(emoji, { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' });
                    }
                });

                const allTasksComplete = result.data?.all_tasks_complete;

                if (state.currentCoinIndex < state.coinElements.length - 1 && !allTasksComplete) {
                    displayNextCoin();
                    state.isProcessing = false;
                    const coinElements = document.querySelectorAll('.seotize-coin');
                    coinElements.forEach(el => el.style.pointerEvents = 'auto');
                } else {
                    debugLog('🎉 All tasks completed!', 'success');
                    await Swal.fire({
                        title: 'CONGRATULATION!',
                        html: `
                            <div class="seotize-gsap-emoji">🎉</div>
                            <div class="seotize-html seotize-congrats">Reward is Yours! You Have Collected all of the Diamonds, you will be redirected to the dashboard.</div>
                        `,
                        timer: CONFIG.TIMING.COMPLETION_DURATION,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        customClass: {
                            popup: 'seotize-popup',
                            title: 'seotize-title'
                        },
                        didOpen: (popup) => {
                            const emoji = popup.querySelector('.seotize-gsap-emoji');
                            gsap.from(emoji, { scale: 0, opacity: 0, y: -50, duration: 0.8, ease: 'bounce.out' });
                        }
                    });
                    
                    window.location.href = 'https://seotize.net/partner/dashboard';
                }
            } else {
                throw new Error(result.data?.message || 'Task submission failed');
            }
        } catch (error) {
            closeLoading();
            debugLog(`✗ Coin click error: ${error.message}`, 'error');
            Swal.fire({
                title: 'Error',
                text: error.message || 'An error occurred',
                icon: 'error',
                confirmButtonText: 'OK'
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
                filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.6));
                will-change: transform, filter;
            }

            .seotize-coin:hover {
                transform: scale(1.3) !important;
            }

            .seotize-arrow {
                will-change: transform;
                filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
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

            .swal2-popup.seotize-popup {
                border-radius: 24px !important;
                padding: 2.5rem 2rem !important;
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
                box-shadow: 0 25px 80px rgba(99, 102, 241, 0.2) !important;
                border: 2px solid rgba(99, 102, 241, 0.1) !important;
            }

            .seotize-gsap-emoji {
                font-size: 5rem;
                line-height: 1;
                margin: 0.5rem auto 1.5rem;
                display: block;
                text-align: center;
                transform-origin: center center;
            }

            .swal2-title.seotize-title {
                font-size: 1.8rem !important;
                font-weight: 900 !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
                margin: 0 !important;
                letter-spacing: -0.5px !important;
            }
            
            .seotize-html {
                font-size: 1.1rem !important;
                line-height: 1.6 !important;
                color: #4b5563; 
                font-weight: 500 !important;
                margin: 0.5rem 0 0 0 !important;
                text-align: center !important;
            }
            
            .seotize-html.seotize-success {
                color: #10b981 !important;
                font-weight: 600 !important;
            }
            
            .seotize-html.seotize-congrats {
                color: #6366f1 !important;
                font-weight: 600 !important;
            }
            
            .seotize-html.seotize-welcome {
                color: #6b7280 !important;
            }
            
            .swal2-icon {
                display: none !important;
            }

            .swal2-timer-progress-bar {
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important;
                height: 4px !important;
            }

            #seotize-debug-log::-webkit-scrollbar {
                width: 8px;
            }

            #seotize-debug-log::-webkit-scrollbar-track {
                background: rgba(0, 255, 0, 0.1);
            }

            #seotize-debug-log::-webkit-scrollbar-thumb {
                background: #00ff00;
                border-radius: 4px;
            }
        `;
        domCache.head.appendChild(style);
    }

    async function waitForDependencies() {
        debugLog('Waiting for dependencies...', 'info');
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
            debugLog('🚀 Starting initialization...', 'info');
            
            await waitForDependencies();

            state.uniqueId = getUniqueId();
            debugLog(`Generated Unique ID: ${state.uniqueId.substring(0, 8)}...`, 'info');
            
            // Don't reset on initial load - wait for auto-generated token
            const token = await waitForTurnstileToken(false);
            const data = await fetchPartnerSubtasks(state.uniqueId, token);

            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                debugLog('⚠ No subtasks info - silent exit', 'warning');
                return;
            }

            state.coins = data.subtasks_info
                .filter(task => task.status === 'incomplete')
                .map(task => task.subtask_id);

            debugLog(`Found ${state.coins.length} incomplete tasks`, 'info');

            if (state.coins.length === 0) {
                debugLog('All tasks complete - showing completion message', 'info');
                Swal.fire({
                    title: 'All Done!',
                    html: `
                        <div class="seotize-gsap-emoji">👍</div>
                        <div class="seotize-html">You have completed all available tasks.</div>
                    `,
                    customClass: {
                        popup: 'seotize-popup',
                        title: 'seotize-title'
                    },
                    didOpen: (popup) => {
                        const emoji = popup.querySelector('.seotize-gsap-emoji');
                        gsap.from(emoji, { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' });
                    }
                });
                return;
            }

            debugLog('✓ Showing welcome message', 'success');
            await Swal.fire({
                title: 'Welcome Seotize Partner!',
                html: `
                    <div class="seotize-gsap-emoji">💎</div>
                    <div class="seotize-html seotize-welcome">Thank you for starting the task, you are at the right place. After this popup closes, please follow the animated arrow to find and click on the first diamond.</div>
                `,
                timer: CONFIG.TIMING.WELCOME_DURATION,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false,
                customClass: {
                    popup: 'seotize-popup',
                    title: 'seotize-title'
                },
                didOpen: (popup) => {
                    const emoji = popup.querySelector('.seotize-gsap-emoji');
                    gsap.from(emoji, { scale: 0, opacity: 0, rotation: 180, duration: 1, ease: 'elastic.out(1, 0.5)' });
                }
            });

            renderCoins();
            displayNextCoin();
            debugLog('✓ Engine initialized successfully!', 'success');

        } catch (error) {
            debugLog(`✗ FATAL ERROR: ${error.message}`, 'error');
            debugLog(`Stack: ${error.stack}`, 'error');
            console.error('Seotize initialization error:', error);
        }
    }

    function setupTurnstile() {
        debugLog('Setting up Turnstile widget', 'info');
        debugLog(`User Agent: ${navigator.userAgent.substring(0, 50)}...`, 'info');
        debugLog(`Platform: ${navigator.platform}`, 'info');
        
        const div = document.createElement('div');
        div.className = 'cf-turnstile';
        div.setAttribute('data-theme', 'light');
        div.setAttribute('data-sitekey', state.systemId);
        div.setAttribute('data-callback', 'onTurnstileCallback');
        div.setAttribute('data-size', 'normal');
        div.setAttribute('data-retry', 'auto');
        div.setAttribute('data-retry-interval', '8000');
        div.setAttribute('data-refresh-expired', 'auto');
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            debugLog('📱 Mobile device detected', 'info');
            div.setAttribute('data-appearance', 'always');
        }

        domCache.body.insertBefore(div, domCache.body.firstChild);
        debugLog('✓ Turnstile container created', 'success');
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
            debugLog('✓ All scripts loaded successfully', 'success');

            return true;
        } catch (error) {
            debugLog(`✗ Failed to load dependencies: ${error.message}`, 'error');
            console.error('Failed to load dependencies:', error);
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

        debugLog('🔧 Bootstrap starting...', 'info');

        const engineScript = getEngineScriptTag();

        if (!engineScript) {
            debugLog('✗ Seotize engine script not found', 'error');
            console.error('Seotize engine script not found.');
            return;
        }

        const queryString = engineScript.src.split('?')[1];
        state.systemId = getURLParameter(queryString, 'id');

        if (!state.systemId) {
            debugLog('✗ System ID not found in script tag', 'error');
            console.error('System ID not found in script tag.');
            return;
        }

        debugLog(`System ID: ${state.systemId}`, 'info');
        window.SYSYID = state.systemId;

        if (!document.referrer.includes('google.com')) {
            debugLog('⚠ Not from Google referrer - silent exit', 'warning');
            return;
        }

        debugLog('✓ Google referrer detected', 'success');

        injectStyles();

        const loaded = await loadDependencies();
        if (!loaded) {
            debugLog('✗ Dependencies failed to load', 'error');
            return;
        }

        setupTurnstile();
        initializeEngine();
    }

    window.onloadTurnstileCallback = function() {
        debugLog('Turnstile script loaded callback', 'info');
        debugLog(`typeof turnstile: ${typeof turnstile}`, 'info');
        
        if (typeof turnstile !== 'undefined') {
            const element = document.querySelector('.cf-turnstile');
            
            if (element) {
                debugLog('Turnstile element found, attempting immediate render...', 'info');
                
                try {
                    state.turnstileWidgetId = turnstile.render(element, {
                        sitekey: state.systemId,
                        theme: 'light',
                        size: 'normal',
                        retry: 'auto',
                        'retry-interval': 8000,
                        'refresh-expired': 'auto',
                        callback: function(token) {
                            debugLog(`✓ Turnstile token auto-generated (length: ${token.length})`, 'success');
                            state.turnstileTokenCache = token;
                            state.lastTokenTime = Date.now();
                        },
                        'error-callback': function() {
                            debugLog('✗ Turnstile error callback triggered', 'error');
                            state.turnstileTokenCache = null;
                        },
                        'expired-callback': function() {
                            debugLog('⚠ Turnstile token expired', 'warning');
                            state.turnstileTokenCache = null;
                        },
                        'timeout-callback': function() {
                            debugLog('✗ Turnstile timeout callback triggered', 'error');
                            state.turnstileTokenCache = null;
                        }
                    });
                    
                    state.turnstileReady = true;
                    debugLog(`✓ Turnstile widget rendered immediately (ID: ${state.turnstileWidgetId})`, 'success');
                } catch (error) {
                    debugLog(`✗ Turnstile render error: ${error.message}`, 'error');
                    debugLog(`Stack: ${error.stack}`, 'error');
                }
            } else {
                debugLog('✗ Turnstile element not found for rendering', 'error');
            }
        } else {
            debugLog('✗ Turnstile object not available', 'error');
        }
    };

    window.onTurnstileCallback = function(token) {
        debugLog(`Turnstile callback triggered (token length: ${token?.length || 0})`, 'info');
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
