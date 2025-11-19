(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
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
            WELCOME_DURATION: 5000,
            SUCCESS_DURATION: 2000,
            COMPLETION_DURATION: 2500,
            POLL_INTERVAL: 100,
            TOKEN_TIMEOUT: 30000
        }
    };

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    const state = {
        systemId: null,
        uniqueId: null,
        coins: [],
        coinElements: [],
        completedTasks: [],
        currentCoinIndex: -1,
        currentArrow: null,
        arrowInterval: null,
        isProcessing: false,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        turnstileReady: false,
        turnstileWidgetId: null,
        turnstileContainer: null
    };

    const dom = {
        body: document.body,
        head: document.head
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    function getViewport() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            scrollHeight: Math.max(
                document.body.scrollHeight,
                document.documentElement.scrollHeight
            )
        };
    }

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

    function getBrowserData() {
        return `${navigator.userAgent}|${navigator.language}|${navigator.platform}|${screen.width}x${screen.height}`;
    }

    function getUniqueId() {
        return CryptoJS.MD5(getBrowserData()).toString();
    }

    function getScriptParam(name) {
        const script = Array.from(document.getElementsByTagName('script'))
            .find(s => s.src.includes('seotize-engine.js'));
        
        if (!script) return null;
        
        const params = new URLSearchParams(script.src.split('?')[1]);
        return params.get(name);
    }

    // ============================================
    // LOADING FUNCTIONS
    // ============================================
    function loadScript(src, defer = false) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = defer;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed: ${src}`));
            dom.head.appendChild(script);
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
            console.error('Dependency load error:', error);
            return false;
        }
    }

    function waitForDependencies() {
        return new Promise((resolve) => {
            const check = () => {
                if (typeof CryptoJS !== 'undefined' &&
                    typeof Swal !== 'undefined' &&
                    typeof gsap !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(check, 50);
                }
            };
            check();
        });
    }

    // ============================================
    // TURNSTILE MANAGEMENT
    // ============================================
    function setupTurnstileContainer() {
        // Create hidden container for invisible mode
        const hiddenDiv = document.createElement('div');
        hiddenDiv.className = 'cf-turnstile-hidden';
        hiddenDiv.setAttribute('data-sitekey', state.systemId);
        hiddenDiv.setAttribute('data-theme', 'light');
        hiddenDiv.setAttribute('data-size', 'normal');
        hiddenDiv.setAttribute('data-callback', 'onTurnstileCallback');
        dom.body.appendChild(hiddenDiv);

        // Create visible container for mobile
        if (state.isMobile) {
            const visibleDiv = document.createElement('div');
            visibleDiv.id = 'seotize-turnstile-container';
            visibleDiv.style.display = 'none';
            dom.body.appendChild(visibleDiv);
            state.turnstileContainer = visibleDiv;
        }
    }

    function waitForTurnstileReady() {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                if (state.turnstileReady && state.turnstileWidgetId !== null) {
                    resolve();
                } else if (Date.now() - startTime > 20000) {
                    reject(new Error('Turnstile timeout'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async function getTurnstileToken() {
        try {
            await waitForTurnstileReady();

            // Mobile: Show visible widget
            if (state.isMobile && state.turnstileContainer) {
                return await getVisibleToken();
            }
            
            // Desktop: Use invisible widget
            return await getInvisibleToken();
            
        } catch (error) {
            console.error('Turnstile error:', error);
            throw error;
        }
    }

    function getVisibleToken() {
        return new Promise((resolve, reject) => {
            // Clear previous widget
            state.turnstileContainer.innerHTML = '';
            
            // Show modal with Turnstile
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
                        turnstile.render(widget, {
                            sitekey: state.systemId,
                            theme: 'light',
                            size: 'normal',
                            callback: (token) => {
                                Swal.close();
                                resolve(token);
                            },
                            'error-callback': () => {
                                Swal.close();
                                reject(new Error('Verification failed'));
                            },
                            'timeout-callback': () => {
                                Swal.close();
                                reject(new Error('Verification timeout'));
                            }
                        });
                    }
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                Swal.close();
                reject(new Error('Verification timeout'));
            }, CONFIG.TIMING.TOKEN_TIMEOUT);
        });
    }

    function getInvisibleToken() {
        return new Promise((resolve, reject) => {
            // Reset invisible widget
            if (typeof turnstile !== 'undefined') {
                turnstile.reset(state.turnstileWidgetId);
            }

            const startTime = Date.now();
            const check = () => {
                const input = document.getElementsByName('cf-turnstile-response')[0];
                
                if (input && input.value) {
                    resolve(input.value);
                } else if (Date.now() - startTime > CONFIG.TIMING.TOKEN_TIMEOUT) {
                    reject(new Error('Token timeout'));
                } else {
                    setTimeout(check, CONFIG.TIMING.POLL_INTERVAL);
                }
            };
            check();
        });
    }

    // ============================================
    // API FUNCTIONS
    // ============================================
    async function fetchTasks() {
        const response = await fetch(CONFIG.API_ENDPOINTS.GET_TASKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unique_id: state.uniqueId,
                site_key: state.systemId
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return await response.json();
    }

    async function submitTask(subtaskId, token) {
        const response = await fetch(CONFIG.API_ENDPOINTS.DO_TASK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unique_id: state.uniqueId,
                'cf-turnstile-response': token,
                sub_task_id: subtaskId
            })
        });

        if (!response.ok) throw new Error(`Submit error: ${response.status}`);
        return await response.json();
    }

    // ============================================
    // COIN & ARROW MANAGEMENT
    // ============================================
    function calculateCoinPositions(count) {
        const viewport = getViewport();
        const sizes = getResponsiveSizes();
        const positions = [];
        const sectionHeight = viewport.scrollHeight / count;

        for (let i = 0; i < count; i++) {
            const y = (i + 0.5) * sectionHeight + (Math.random() - 0.5) * sectionHeight * 0.3;
            const x = sizes.margin + Math.random() * (viewport.width - sizes.coin - sizes.margin * 2);
            positions.push({ x, y });
        }

        return positions;
    }

    function createCoin(subtaskId, x, y) {
        const sizes = getResponsiveSizes();
        const coin = document.createElement('div');
        coin.className = 'seotize-coin';
        coin.setAttribute('data-subtask-id', subtaskId);
        coin.innerHTML = '💎';
        
        Object.assign(coin.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            fontSize: `${sizes.coin}px`,
            cursor: 'pointer',
            zIndex: '999999',
            display: 'none'
        });

        coin.addEventListener('click', () => handleCoinClick(subtaskId), { passive: true });
        return coin;
    }

    function renderCoins() {
        const positions = calculateCoinPositions(state.coins.length);
        
        state.coins.forEach((subtaskId, index) => {
            const { x, y } = positions[index];
            const coin = createCoin(subtaskId, x, y);
            dom.body.appendChild(coin);
            state.coinElements.push(coin);
        });
    }

    function displayNextCoin() {
        state.currentCoinIndex++;
        
        if (state.currentCoinIndex >= state.coinElements.length) return;

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
                scale: 1.1,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
                duration: 1.5
            });
        }

        createArrow(coin);
    }

    function createArrow(target) {
        // Remove old arrow
        if (state.currentArrow) {
            if (typeof gsap !== 'undefined') gsap.killTweensOf(state.currentArrow);
            state.currentArrow.remove();
        }
        if (state.arrowInterval) clearInterval(state.arrowInterval);

        const sizes = getResponsiveSizes();
        const arrow = document.createElement('div');
        arrow.innerHTML = '👇';
        
        Object.assign(arrow.style, {
            position: 'fixed',
            fontSize: `${sizes.arrow}px`,
            pointerEvents: 'none',
            zIndex: '999998'
        });

        dom.body.appendChild(arrow);
        state.currentArrow = arrow;

        const updatePosition = () => {
            if (!target.parentNode) {
                arrow.remove();
                if (state.arrowInterval) clearInterval(state.arrowInterval);
                return;
            }

            const rect = target.getBoundingClientRect();
            const viewport = getViewport();
            const isVisible = rect.top >= 0 && rect.bottom <= viewport.height;

            if (typeof gsap !== 'undefined') gsap.killTweensOf(arrow);

            if (isVisible) {
                arrow.innerHTML = '👇';
                arrow.style.top = `${rect.top - sizes.arrowOffset}px`;
                arrow.style.left = `${rect.left + rect.width / 2 - sizes.arrow / 2}px`;
                gsap.to(arrow, { y: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
            } else {
                arrow.style.left = `${viewport.width / 2 - sizes.arrow / 2}px`;
                
                if (rect.bottom < 0) {
                    arrow.innerHTML = '👆';
                    arrow.style.top = '10px';
                    gsap.to(arrow, { y: -10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                } else {
                    arrow.innerHTML = '👇';
                    arrow.style.top = `${viewport.height - sizes.arrow - 10}px`;
                    gsap.to(arrow, { y: 10, repeat: -1, yoyo: true, ease: "sine.inOut", duration: 0.6 });
                }
            }
        };

        updatePosition();
        state.arrowInterval = setInterval(updatePosition, 100);
    }

    // ============================================
    // COIN CLICK HANDLER
    // ============================================
    async function handleCoinClick(subtaskId) {
        if (state.isProcessing) return;

        const coin = state.coinElements[state.currentCoinIndex];
        if (coin.getAttribute('data-subtask-id') !== subtaskId) return;

        state.isProcessing = true;

        // Disable all coins
        document.querySelectorAll('.seotize-coin').forEach(el => el.style.pointerEvents = 'none');

        try {
            // Animate coin
            if (typeof gsap !== 'undefined') {
                gsap.to(coin, {
                    scale: 2,
                    opacity: 0,
                    rotation: 360,
                    duration: 0.4,
                    ease: "power2.in"
                });
            }

            // Remove arrow
            if (state.currentArrow) {
                if (typeof gsap !== 'undefined') gsap.killTweensOf(state.currentArrow);
                state.currentArrow.remove();
            }
            if (state.arrowInterval) clearInterval(state.arrowInterval);

            await new Promise(r => setTimeout(r, 400));

            // Show loading for mobile, or silent for desktop
            if (state.isMobile) {
                showLoading('Verifying', 'Please complete the security check');
            } else {
                showLoading('Verifying', 'Please wait...');
            }

            // Get token (shows captcha on mobile, invisible on desktop)
            const token = await getTurnstileToken();
            
            // Submit task
            const result = await submitTask(subtaskId, token);
            
            closeLoading();

            if (result.status === 'success' || result.code === 200) {
                state.completedTasks.push(subtaskId);
                coin.remove();

                const remaining = state.coinElements.length - (state.currentCoinIndex + 1);

                await showSuccess(remaining);

                if (state.currentCoinIndex < state.coinElements.length - 1 && !result.data?.all_tasks_complete) {
                    displayNextCoin();
                    state.isProcessing = false;
                    document.querySelectorAll('.seotize-coin').forEach(el => el.style.pointerEvents = 'auto');
                } else {
                    await showCompletion();
                    window.location.href = 'https://seotize.net/partner/dashboard';
                }
            } else {
                throw new Error(result.data?.message || 'Task failed');
            }

        } catch (error) {
            closeLoading();
            console.error('Coin click error:', error);
            await showError(error.message);
        } finally {
            state.isProcessing = false;
            document.querySelectorAll('.seotize-coin').forEach(el => el.style.pointerEvents = 'auto');
        }
    }

    // ============================================
    // UI MODALS
    // ============================================
    function showLoading(title, message) {
        if (typeof Swal === 'undefined') return;
        
        Swal.fire({
            html: `
                <div class="seotize-modal">
                    <div class="seotize-spinner"></div>
                    <h2>${title}</h2>
                    ${message ? `<p>${message}</p>` : ''}
                </div>
            `,
            allowOutsideClick: false,
            showConfirmButton: false,
            background: 'transparent',
            backdrop: 'rgba(0, 0, 0, 0.9)',
            customClass: { popup: 'seotize-popup' }
        });
    }

    function closeLoading() {
        if (typeof Swal !== 'undefined') Swal.close();
    }

    async function showWelcome() {
        await Swal.fire({
            html: `
                <div class="seotize-modal seotize-welcome">
                    <div class="seotize-icon">💎</div>
                    <h2>Welcome Partner!</h2>
                    <p>Collect diamonds and earn rewards</p>
                    <div class="seotize-features">
                        <div class="seotize-feature">
                            <span>🎯</span> Follow the arrow
                        </div>
                        <div class="seotize-feature">
                            <span>💎</span> Click each diamond
                        </div>
                        <div class="seotize-feature">
                            <span>🏆</span> Collect all ${state.coins.length}
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
            backdrop: 'rgba(0, 0, 0, 0.9)',
            customClass: { popup: 'seotize-popup' }
        });
    }

    async function showSuccess(remaining) {
        await Swal.fire({
            html: `
                <div class="seotize-modal seotize-success">
                    <div class="seotize-checkmark">✓</div>
                    <h2>Diamond Collected!</h2>
                    <p>Great work! Keep going</p>
                    <div class="seotize-progress">
                        <div class="seotize-progress-text">
                            <span class="seotize-big">${state.completedTasks.length}</span>
                            <span>/</span>
                            <span>${state.coinElements.length}</span>
                            Complete
                        </div>
                        <div class="seotize-progress-bar">
                            <div style="width: ${(state.completedTasks.length / state.coinElements.length) * 100}%"></div>
                        </div>
                    </div>
                    ${remaining > 0 ? `<p class="seotize-remaining">${remaining} more to go!</p>` : ''}
                </div>
            `,
            timer: CONFIG.TIMING.SUCCESS_DURATION,
            timerProgressBar: true,
            showConfirmButton: false,
            allowOutsideClick: false,
            background: 'transparent',
            backdrop: 'rgba(0, 0, 0, 0.9)',
            customClass: { popup: 'seotize-popup' }
        });
    }

    async function showCompletion() {
        await Swal.fire({
            html: `
                <div class="seotize-modal seotize-completion">
                    <div class="seotize-trophy">🏆</div>
                    <h2>Congratulations!</h2>
                    <p>You collected all diamonds!</p>
                    <div class="seotize-stat">
                        <div class="seotize-stat-value">${state.coinElements.length}</div>
                        <div>Diamonds</div>
                    </div>
                    <p>Redirecting to dashboard...</p>
                </div>
            `,
            timer: CONFIG.TIMING.COMPLETION_DURATION,
            timerProgressBar: true,
            showConfirmButton: false,
            allowOutsideClick: false,
            background: 'transparent',
            backdrop: 'rgba(0, 0, 0, 0.9)',
            customClass: { popup: 'seotize-popup' }
        });
    }

    async function showError(message) {
        await Swal.fire({
            html: `
                <div class="seotize-modal seotize-error">
                    <div class="seotize-icon">⚠️</div>
                    <h2>Something went wrong</h2>
                    <p>${message || 'Please try again'}</p>
                    <button class="seotize-btn" onclick="Swal.close()">OK</button>
                </div>
            `,
            showConfirmButton: false,
            background: 'transparent',
            backdrop: 'rgba(0, 0, 0, 0.9)',
            customClass: { popup: 'seotize-popup' }
        });
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

            /* Hidden Turnstile */
            .cf-turnstile-hidden {
                position: fixed !important;
                top: -9999px !important;
                left: -9999px !important;
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
            }

            /* Coins */
            .seotize-coin {
                filter: drop-shadow(0 0 10px rgba(99, 102, 241, 0.5));
                transition: transform 0.2s;
            }

            .seotize-coin:active {
                transform: scale(1.2) !important;
            }

            /* Popups */
            .seotize-popup {
                padding: 0 !important;
                background: transparent !important;
                box-shadow: none !important;
            }

            .seotize-modal {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: clamp(1.5rem, 5vw, 2.5rem);
                border-radius: clamp(12px, 3vw, 20px);
                text-align: center;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                max-width: 90vw;
                width: clamp(280px, 90vw, 420px);
                margin: 0 auto;
            }

            .seotize-modal h2 {
                font-size: clamp(1.3rem, 4vw, 1.8rem);
                font-weight: 800;
                color: #fff;
                margin: 0.8rem 0 0.5rem;
            }

            .seotize-modal p {
                font-size: clamp(0.9rem, 3vw, 1rem);
                color: rgba(255, 255, 255, 0.9);
                margin: 0.5rem 0;
            }

            .seotize-icon, .seotize-trophy {
                font-size: clamp(2.5rem, 8vw, 3.5rem);
            }

            .seotize-checkmark {
                width: clamp(50px, 15vw, 70px);
                height: clamp(50px, 15vw, 70px);
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto;
                font-size: clamp(1.8rem, 6vw, 2.5rem);
                color: #fff;
                font-weight: bold;
            }

            .seotize-spinner {
                width: clamp(40px, 10vw, 50px);
                height: clamp(40px, 10vw, 50px);
                margin: 0 auto 1rem;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top-color: #fff;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            .seotize-features {
                background: rgba(255, 255, 255, 0.15);
                padding: clamp(0.8rem, 3vw, 1.2rem);
                border-radius: clamp(8px, 2vw, 12px);
                margin: 1rem 0;
            }

            .seotize-feature {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: #fff;
                font-size: clamp(0.85rem, 2.5vw, 0.95rem);
                margin: 0.5rem 0;
            }

            .seotize-feature span:first-child {
                font-size: clamp(1rem, 3vw, 1.3rem);
            }

            .seotize-progress {
                background: rgba(255, 255, 255, 0.15);
                padding: clamp(0.8rem, 3vw, 1.2rem);
                border-radius: clamp(8px, 2vw, 12px);
                margin: 1rem 0;
            }

            .seotize-progress-text {
                display: flex;
                align-items: baseline;
                justify-content: center;
                gap: 0.3rem;
                color: #fff;
                font-weight: 700;
                margin-bottom: 0.6rem;
                font-size: clamp(0.9rem, 3vw, 1.1rem);
            }

            .seotize-big {
                font-size: clamp(1.5rem, 5vw, 2rem);
                color: #10b981;
            }

            .seotize-progress-bar {
                width: 100%;
                height: clamp(6px, 2vw, 8px);
                background: rgba(0, 0, 0, 0.2);
                border-radius: clamp(3px, 1vw, 4px);
                overflow: hidden;
            }

            .seotize-progress-bar > div {
                height: 100%;
                background: linear-gradient(90deg, #10b981, #34d399);
                transition: width 0.6s ease;
            }

            .seotize-stat {
                background: rgba(255, 255, 255, 0.15);
                padding: clamp(0.8rem, 3vw, 1.2rem);
                border-radius: clamp(8px, 2vw, 12px);
                margin: 1rem 0;
            }

            .seotize-stat-value {
                font-size: clamp(1.8rem, 6vw, 2.5rem);
                font-weight: 900;
                color: #fff;
                margin-bottom: 0.2rem;
            }

            .seotize-btn {
                background: #fff;
                color: #667eea;
                border: none;
                padding: clamp(0.5rem, 2vw, 0.7rem) clamp(1.2rem, 4vw, 1.8rem);
                border-radius: clamp(6px, 2vw, 8px);
                font-size: clamp(0.9rem, 3vw, 1rem);
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .seotize-btn:active {
                transform: scale(0.95);
            }

            .seotize-completion {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }

            .seotize-error {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            }

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

            /* Responsive tweaks */
            @media (max-width: 480px) {
                .seotize-modal {
                    padding: 1.5rem 1rem;
                }
            }

            @media (max-width: 360px) {
                .seotize-captcha-container {
                    padding: 1.2rem 0.8rem;
                }
                
                #seotize-captcha-widget iframe {
                    transform: scale(0.9);
                    transform-origin: center;
                }
            }
        `;
        dom.head.appendChild(style);
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    async function initialize() {
        try {
            await waitForDependencies();

            state.uniqueId = getUniqueId();
            const data = await fetchTasks();

            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                return;
            }

            state.coins = data.subtasks_info
                .filter(task => task.status === 'incomplete')
                .map(task => task.subtask_id);

            if (state.coins.length === 0) {
                await Swal.fire({
                    html: `
                        <div class="seotize-modal">
                            <div class="seotize-icon">✅</div>
                            <h2>All Done!</h2>
                            <p>You've completed all tasks</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    background: 'transparent',
                    backdrop: 'rgba(0, 0, 0, 0.9)',
                    customClass: { popup: 'seotize-popup' }
                });
                return;
            }

            await showWelcome();
            renderCoins();
            displayNextCoin();

        } catch (error) {
            console.error('Init error:', error);
        }
    }

    // ============================================
    // TURNSTILE CALLBACKS
    // ============================================
    window.onloadTurnstileCallback = function() {
        if (typeof turnstile !== 'undefined') {
            const element = document.querySelector('.cf-turnstile-hidden');
            
            if (element) {
                try {
                    state.turnstileWidgetId = turnstile.render(element, {
                        sitekey: state.systemId,
                        theme: 'light',
                        callback: () => {}
                    });
                    
                    state.turnstileReady = true;
                } catch (error) {
                    console.error('Turnstile init error:', error);
                }
            }
        }
    };

    window.onTurnstileCallback = function(token) {
        // Callback placeholder
    };

    // ============================================
    // BOOTSTRAP
    // ============================================
    async function bootstrap() {
        // Get system ID
        state.systemId = getScriptParam('id');
        if (!state.systemId) return;

        window.SYSYID = state.systemId;

        // Check referrer
        if (!document.referrer.includes('google.com')) return;

        // Inject styles
        injectStyles();

        // Load dependencies
        const loaded = await loadDependencies();
        if (!loaded) return;

        // Setup Turnstile
        setupTurnstileContainer();

        // Initialize
        await initialize();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
