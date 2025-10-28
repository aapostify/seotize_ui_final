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
            POLL_INTERVAL: 100
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
        dependenciesLoaded: false
    };

    let domCache = null;

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
            const script = document.createElement('script');
            script.src = src;
            script.defer = defer;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
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

    async function waitForTurnstileToken() {
        return new Promise((resolve, reject) => {
            const checkToken = () => {
                const responseElement = document.getElementsByName('cf-turnstile-response')[0];

                if (responseElement?.value) {
                    resolve(responseElement.value);
                    return;
                }

                if (!responseElement) {
                    const observer = new MutationObserver(() => {
                        const elem = document.getElementsByName('cf-turnstile-response')[0];
                        if (elem) {
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

            setTimeout(() => reject(new Error('Turnstile timeout')), 30000);
        });
    }

    async function fetchPartnerSubtasks(uniqueId, turnstileToken) {
        const response = await fetch(CONFIG.API_ENDPOINTS.GET_TASKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unique_id: uniqueId,
                'cf-turnstile-response': turnstileToken
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async function submitTask(subtaskId, turnstileToken) {
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

        return await response.json();
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

    // =================================================================
    // == THIS IS THE UPDATED FUNCTION ==
    // =================================================================
    function createArrowToCoin(targetCoin) {
        // Clear any existing arrow and its animation/interval
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

        // Create new arrow element
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

        // This function now handles all visibility logic
        const updateArrowPosition = () => {
            if (!targetCoin || !targetCoin.parentNode) {
                if (arrow && arrow.parentNode) {
                    arrow.parentNode.removeChild();
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

            // Stop any ongoing animation before repositioning
            if (typeof gsap !== 'undefined') {
                gsap.killTweensOf(arrow);
            }

            if (isVisible) {
                // Coin is ON-SCREEN: Point down at it
                arrow.style.top = (rect.top - CONFIG.ARROW.OFFSET) + 'px';
                arrow.style.left = (targetX - arrowWidth / 2) + 'px';
                arrow.innerHTML = '👇';
                arrow.style.transform = ''; // Clear edge-pinning transforms
                
                // Apply bounce animation
                gsap.to(arrow, {
                    y: 10,
                    repeat: -1,
                    yoyo: true,
                    ease: "power1.inOut",
                    duration: 0.5
                });

            } else {
                // Coin is OFF-SCREEN: Pin arrow to the correct edge
                arrow.style.opacity = '1';
                arrow.style.transform = 'translateY(0)'; // Reset transform

                if (rect.bottom < 0) {
                    // Target is ABOVE viewport
                    arrow.style.top = '10px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👆';
                    gsap.to(arrow, { y: -10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });

                } else if (rect.top > viewportHeight) {
                    // Target is BELOW viewport
                    arrow.style.top = (viewportHeight - arrowHeight - 10) + 'px';
                    arrow.style.left = (viewportWidth / 2 - arrowWidth / 2) + 'px';
                    arrow.innerHTML = '👇';
                    gsap.to(arrow, { y: 10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });

                } else if (rect.right < 0) {
                    // Target is to the LEFT
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = '10px';
                    arrow.innerHTML = '👈';
                    gsap.to(arrow, { x: -10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });

                } else if (rect.left > viewportWidth) {
                    // Target is to the RIGHT
                    arrow.style.top = (viewportHeight / 2 - arrowHeight / 2) + 'px';
                    arrow.style.left = (viewportWidth - arrowWidth - 10) + 'px';
                    arrow.innerHTML = '👉';
                    gsap.to(arrow, { x: 10, repeat: -1, yoyo: true, ease: "power1.inOut", duration: 0.5 });
                }
            }
        };

        updateArrowPosition(); // Run once immediately
        state.arrowUpdateInterval = setInterval(updateArrowPosition, CONFIG.ARROW.UPDATE_INTERVAL);
    }
    // =================================================================
    // == END OF UPDATED FUNCTION ==
    // =================================================================

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
                    duration: 0.6,
                    ease: "power2.in"
                });
            }

            // Clean up the arrow
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

            const token = await waitForTurnstileToken();
            const result = await submitTask(subtaskId, token);

            closeLoading();

            if (result.status === 'success' || result.code === 200) {
                state.completedTasks.push(subtaskId);
                clickedCoin.remove();

                const remainingTasks = state.coinElements.length - (state.currentCoinIndex + 1);

                await Swal.fire({
                    title: `✓ GOOD JOB, ${remainingTasks} MORE!`,
                    html: `<div style="font-size: 1.1rem; color: #10b981; font-weight: 600;">You Have Collected a Diamond! ${remainingTasks} More To Go!</div>`,
                    icon: 'success',
                    timer: CONFIG.TIMING.SUCCESS_DURATION,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false,
                    customClass: {
                        popup: 'seotize-popup',
                        title: 'seotize-title'
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
                        title: '🎉 CONGRATULATION!',
                        html: '<div style="font-size: 1.1rem; color: #6366f1; font-weight: 600;">Reward is Yours! You Have Collected all of the Diamonds, you will be redirected to the dashboard.</div>',
                        icon: 'success',
                        timer: CONFIG.TIMING.COMPLETION_DURATION,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false,
                        customClass: {
                            popup: 'seotize-popup',
                            title: 'seotize-title'
                        }
                    });

                    window.location.href = 'https://seotize.net/partner/dashboard';
                }
            } else {
                throw new Error(result.data?.message || 'Task submission failed');
            }
        } catch (error) {
            closeLoading();
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
                padding: 2.5rem !important;
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
                box-shadow: 0 25px 80px rgba(99, 102, 241, 0.2) !important;
                border: 2px solid rgba(99, 102, 241, 0.1) !important;
            }

            .swal2-title.seotize-title {
                font-size: 2rem !important;
                font-weight: 900 !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
                margin-bottom: 1rem !important;
                letter-spacing: -0.5px !important;
            }

            .swal2-icon.swal2-success {
                border-color: #10b981 !important;
            }

            .swal2-icon.swal2-success [class^='swal2-success-line'] {
                background-color: #10b981 !important;
            }

            .swal2-icon.swal2-success .swal2-success-ring {
                border-color: rgba(16, 185, 129, 0.3) !important;
            }

            .swal2-timer-progress-bar {
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important;
                height: 4px !important;
            }

            .swal2-html-container {
                font-size: 1.05rem !important;
                line-height: 1.6 !important;
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
            const token = await waitForTurnstileToken();
            const data = await fetchPartnerSubtasks(state.uniqueId, token);

            closeLoading();

            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                return;
            }

            state.coins = data.subtasks_info
                .filter(task => task.status === 'incomplete')
                .map(task => task.subtask_id);

            if (state.coins.length === 0) {
                Swal.fire({
                    title: '✓ All Done!',
                    text: 'You have completed all available tasks.',
                    icon: 'info',
                    customClass: {
                        popup: 'seotize-popup',
                        title: 'seotize-title'
                    }
                });
                return;
            }

            await Swal.fire({
                title: '💎 Welcome Seotize Partner!',
                html: '<div style="font-size: 1.1rem; line-height: 1.7; color: #6b7280; font-weight: 500;">Thank you for starting the task, you are at the right place. After this popup closes, please follow the animated arrow to find and click on the first diamond.</div>',
                icon: 'info',
                timer: CONFIG.TIMING.WELCOME_DURATION,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false,
                customClass: {
                    popup: 'seotize-popup',
                    title: 'seotize-title'
                }
            });

            renderCoins();
            displayNextCoin();

        } catch (error) {
            console.error('Seotize initialization error:', error);
        }
    }

    function setupTurnstile() {
        const div = document.createElement('div');
        div.className = 'cf-turnstile';
        div.setAttribute('data-theme', 'light');
        div.setAttribute('data-sitekey', state.systemId);

        domCache.body.insertBefore(div, domCache.body.firstChild);
    }

    async function loadDependencies() {
        try {
            await loadScript(CONFIG.CDN.CRYPTO);
            await loadScript(CONFIG.CDN.SWEETALERT);
            await loadScript(CONFIG.CDN.GSAP);
            await loadScript(CONFIG.CDN.TURNSTILE, true);

            return true;
        } catch (error) {
            console.error('Failed to load dependencies:', error);
            return false;
        }
    }

    async function bootstrap() {
        domCache = {
            body: document.body,
            head: document.head
        };

        const engineScript = getEngineScriptTag();

        if (!engineScript) {
            console.error('Seotize engine script not found.');
            return;
        }

        const queryString = engineScript.src.split('?')[1];
        state.systemId = getURLParameter(queryString, 'id');

        if (!state.systemId) {
            console.error('System ID not found in script tag.');
            return;
        }

        window.SYSYID = state.systemId;

        if (!document.referrer.includes('google.com')) {
            return;
        }

        injectStyles();

        const loaded = await loadDependencies();
        if (!loaded) return;

        setupTurnstile();
    }

    window.onloadTurnstileCallback = function() {
        initializeEngine();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
