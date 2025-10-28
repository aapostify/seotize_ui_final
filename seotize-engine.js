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
            ANIME: 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js'
        },
        DIAMOND: {
            SIZE: 45,
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
        diamonds: [],
        diamondElements: [],
        completedTasks: [],
        currentDiamondIndex: -1,
        currentArrow: null,
        arrowUpdateInterval: null,
        isProcessing: false
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

    function createDiamondSVG(subtaskId, xPosition, yPosition) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const size = CONFIG.DIAMOND.SIZE;
        
        svg.setAttribute('width', `${size}px`);
        svg.setAttribute('height', `${size}px`);
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('data-subtask-id', subtaskId);
        svg.classList.add('seotize-diamond');
        
        Object.assign(svg.style, {
            position: 'absolute',
            left: `${xPosition}px`,
            top: `${yPosition}px`,
            cursor: 'pointer',
            zIndex: '999999',
            pointerEvents: 'auto',
            filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.8))',
            transition: 'transform 0.2s ease'
        });

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M2.5 8.5 L8 2.5 L13.5 8.5 L8 14.5 Z');
        path.setAttribute('stroke', '#ffffff');
        path.setAttribute('stroke-width', '0.8');
        path.setAttribute('fill', '#3b82f6');
        
        svg.appendChild(path);
        svg.addEventListener('click', () => handleDiamondClick(subtaskId));
        
        return svg;
    }

    function calculateDiamondPositions(count) {
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
        const svgSize = CONFIG.DIAMOND.SIZE;
        const margin = CONFIG.DIAMOND.MIN_MARGIN;
        const sectionHeight = scrollHeight / count;
        const variance = CONFIG.DIAMOND.SECTION_VARIANCE;

        for (let i = 0; i < count; i++) {
            const sectionStart = i * sectionHeight;
            const sectionEnd = (i + 1) * sectionHeight;
            const y = sectionStart + (sectionEnd - sectionStart) * 0.5 + (Math.random() - 0.5) * (sectionHeight * variance);
            const x = Math.random() * (viewportWidth - svgSize - (margin * 2)) + margin;
            
            positions.push({ x, y });
        }

        return positions;
    }

    function renderDiamonds() {
        const positions = calculateDiamondPositions(state.diamonds.length);
        
        state.diamonds.forEach((subtaskId, index) => {
            const { x, y } = positions[index];
            const diamond = createDiamondSVG(subtaskId, x, y);
            diamond.style.display = 'none';
            domCache.body.appendChild(diamond);
            state.diamondElements.push(diamond);
        });
    }

    function displayNextDiamond() {
        state.currentDiamondIndex++;
        
        if (state.currentDiamondIndex >= state.diamondElements.length) {
            return;
        }

        const diamond = state.diamondElements[state.currentDiamondIndex];
        diamond.style.display = 'block';
        
        if (typeof anime !== 'undefined') {
            anime({
                targets: diamond,
                scale: [0, 1],
                opacity: [0, 1],
                duration: 800,
                easing: 'easeOutElastic(1, .5)'
            });
        }

        createArrowToDiamond(diamond);
    }

    function createArrowToDiamond(targetDiamond) {
        if (state.currentArrow) {
            state.currentArrow.remove();
            if (state.arrowUpdateInterval) {
                clearInterval(state.arrowUpdateInterval);
            }
        }

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        arrow.setAttribute('width', `${CONFIG.ARROW.SIZE}px`);
        arrow.setAttribute('height', `${CONFIG.ARROW.SIZE}px`);
        arrow.setAttribute('viewBox', '0 0 24 24');
        arrow.classList.add('seotize-arrow');
        
        Object.assign(arrow.style, {
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: '999998',
            filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.6))'
        });

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 2 L12 18 M12 18 L6 12 M12 18 L18 12');
        path.setAttribute('stroke', '#ffd700');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('fill', 'none');
        
        arrow.appendChild(path);
        domCache.body.appendChild(arrow);
        state.currentArrow = arrow;

        const updateArrowPosition = () => {
            const diamondRect = targetDiamond.getBoundingClientRect();
            const diamondCenterX = diamondRect.left + (diamondRect.width / 2);
            const diamondCenterY = diamondRect.top + (diamondRect.height / 2);
            
            const offsetDistance = CONFIG.ARROW.OFFSET;
            const arrowX = diamondCenterX - (CONFIG.ARROW.SIZE / 2);
            const arrowY = diamondCenterY - offsetDistance - (CONFIG.ARROW.SIZE / 2);
            
            arrow.style.left = `${arrowX}px`;
            arrow.style.top = `${arrowY}px`;
        };

        updateArrowPosition();
        state.arrowUpdateInterval = setInterval(updateArrowPosition, CONFIG.ARROW.UPDATE_INTERVAL);

        if (typeof anime !== 'undefined') {
            anime({
                targets: arrow,
                translateY: [0, 10],
                duration: 1000,
                easing: 'easeInOutQuad',
                direction: 'alternate',
                loop: true
            });
        }
    }

    async function handleDiamondClick(subtaskId) {
        if (state.isProcessing) return;
        
        const clickedDiamond = state.diamondElements[state.currentDiamondIndex];
        const clickedSubtaskId = clickedDiamond.getAttribute('data-subtask-id');
        
        if (clickedSubtaskId !== subtaskId) return;
        
        state.isProcessing = true;
        
        const diamondElements = document.querySelectorAll('.seotize-diamond');
        diamondElements.forEach(el => el.style.pointerEvents = 'none');

        try {
            if (typeof anime !== 'undefined') {
                anime({
                    targets: clickedDiamond,
                    scale: [1, 1.5, 0],
                    opacity: [1, 1, 0],
                    duration: 600,
                    easing: 'easeInOutQuad'
                });
            }

            if (state.currentArrow) {
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
                clickedDiamond.remove();

                const remainingTasks = state.diamondElements.length - (state.currentDiamondIndex + 1);

                await Swal.fire({
                    title: '✓ Task Complete',
                    html: `<div style="font-size: 1rem; color: #10b981; font-weight: 500;">Great job! ${remainingTasks} more to go!</div>`,
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
                
                if (state.currentDiamondIndex < state.diamondElements.length - 1 && !allTasksComplete) {
                    displayNextDiamond();
                    state.isProcessing = false;
                    const diamondElements = document.querySelectorAll('.seotize-diamond');
                    diamondElements.forEach(el => el.style.pointerEvents = 'auto');
                } else {
                    await Swal.fire({
                        title: '🎉 All Tasks Complete!',
                        html: '<div style="font-size: 1rem; color: #6366f1; font-weight: 500;">Congratulations! Returning to dashboard...</div>',
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
            
            const diamondElements = document.querySelectorAll('.seotize-diamond');
            diamondElements.forEach(el => el.style.pointerEvents = 'auto');
        }
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes seotizeDiamondGlow {
                0%, 100% { fill: #3b82f6; }
                25% { fill: #8b5cf6; }
                50% { fill: #ec4899; }
                75% { fill: #f59e0b; }
            }

            .seotize-diamond {
                animation: seotizeDiamondGlow 7s linear infinite;
                will-change: transform, filter;
            }

            .seotize-diamond:hover {
                transform: scale(1.1) !important;
            }

            .seotize-arrow {
                will-change: transform;
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
                border-radius: 20px !important;
                padding: 2.5rem !important;
                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
                box-shadow: 0 20px 60px rgba(99, 102, 241, 0.15) !important;
            }

            .swal2-title.seotize-title {
                font-size: 1.75rem !important;
                font-weight: 800 !important;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
                margin-bottom: 1rem !important;
            }

            .swal2-icon.swal2-success {
                border-color: #10b981 !important;
            }

            .swal2-icon.swal2-success [class^='swal2-success-line'] {
                background-color: #10b981 !important;
            }

            .swal2-timer-progress-bar {
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important;
            }
        `;
        domCache.head.appendChild(style);
    }

    async function initializeEngine() {
        try {
            state.uniqueId = getUniqueId();
            const token = await waitForTurnstileToken();
            const data = await fetchPartnerSubtasks(state.uniqueId, token);
            
            closeLoading();
            
            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                return;
            }

            state.diamonds = data.subtasks_info
                .filter(task => task.status === 'incomplete')
                .map(task => task.subtask_id);

            if (state.diamonds.length === 0) {
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
                html: '<div style="font-size: 1.05rem; line-height: 1.6; color: #6b7280;">Follow the animated arrow and click on the glowing diamonds to complete your tasks. Each completed task earns you rewards!</div>',
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

            renderDiamonds();
            displayNextDiamond();

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
            await Promise.all([
                loadScript(CONFIG.CDN.CRYPTO),
                loadScript(CONFIG.CDN.SWEETALERT),
                loadScript(CONFIG.CDN.ANIME),
                loadScript(CONFIG.CDN.TURNSTILE, true)
            ]);
            
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
