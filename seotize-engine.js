/**
 * Seotize Engine - Optimized Version
 * Performance improvements, bug fixes, and enhanced UI
 */

(function() {
    'use strict';

    // ============================================================================
    // CONFIGURATION & CONSTANTS
    // ============================================================================
    
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
            WELCOME_DURATION: 8000,
            SUCCESS_DURATION: 2000,
            COMPLETION_DURATION: 3000,
            POLL_INTERVAL: 100
        }
    };

    // ============================================================================
    // STATE MANAGEMENT
    // ============================================================================
    
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

    // ============================================================================
    // DOM CACHE
    // ============================================================================
    
    let domCache = null;

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    
    /**
     * Get script tag containing seotize-engine.js
     */
    function getEngineScriptTag() {
        const scripts = document.getElementsByTagName('script');
        return Array.from(scripts).find(script => 
            script.src.includes('seotize-engine.js')
        );
    }

    /**
     * Extract URL parameter from query string
     */
    function getURLParameter(queryString, name) {
        if (!queryString) return null;
        const params = new URLSearchParams(queryString);
        return params.get(name);
    }

    /**
     * Get browser data for unique ID generation (matches dashboard)
     */
    function getBrowserData() {
        var userAgent = navigator.userAgent;
        var language = navigator.language;
        var platform = navigator.platform;
        var screenResolution = screen.width + 'x' + screen.height;
        var combinedData = `${userAgent}|${language}|${platform}|${screenResolution}`;
        return combinedData;
    }

    /**
     * Hash data using MD5
     */
    function hashData(data) {
        return CryptoJS.MD5(data).toString();
    }

    /**
     * Generate unique ID (matches dashboard implementation)
     */
    function getUniqueId() {
        var browserData = getBrowserData();
        return hashData(browserData);
    }

    /**
     * Debounce function for performance optimization
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Load script dynamically with promise
     */
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

    /**
     * Show loading indicator
     */
    function showLoading(title = 'Loading...') {
        if (typeof Swal === 'undefined') return;
        
        Swal.fire({
            title,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });
    }

    /**
     * Close loading indicator
     */
    function closeLoading() {
        if (typeof Swal !== 'undefined') {
            Swal.close();
        }
    }

    // ============================================================================
    // API FUNCTIONS
    // ============================================================================
    
    /**
     * Wait for Turnstile response token
     */
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
            
            // Timeout after 30 seconds
            setTimeout(() => reject(new Error('Turnstile timeout')), 30000);
        });
    }

    /**
     * Fetch partner subtasks
     */
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

    /**
     * Submit completed task
     */
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

    // ============================================================================
    // DIAMOND FUNCTIONS
    // ============================================================================
    
    /**
     * Create diamond SVG element
     */
    function createDiamondSVG(subtaskId, xPosition, yPosition) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const size = CONFIG.DIAMOND.SIZE;
        
        svg.setAttribute('width', `${size}px`);
        svg.setAttribute('height', `${size}px`);
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('data-subtask-id', subtaskId);
        svg.classList.add('seotize-diamond');
        
        Object.assign(svg.style, {
            position: 'fixed',
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

    /**
     * Calculate diamond positions
     */
    function calculateDiamondPositions(count) {
        const positions = [];
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = CONFIG.DIAMOND.MIN_MARGIN;
        const variance = CONFIG.DIAMOND.SECTION_VARIANCE;
        
        const usableWidth = viewportWidth - (2 * margin);
        const usableHeight = viewportHeight - (2 * margin);
        
        const sectionsX = Math.ceil(Math.sqrt(count));
        const sectionsY = Math.ceil(count / sectionsX);
        
        const sectionWidth = usableWidth / sectionsX;
        const sectionHeight = usableHeight / sectionsY;

        for (let i = 0; i < count; i++) {
            const sectionIndexX = i % sectionsX;
            const sectionIndexY = Math.floor(i / sectionsX);
            
            const baseCenterX = margin + (sectionIndexX * sectionWidth) + (sectionWidth / 2);
            const baseCenterY = margin + (sectionIndexY * sectionHeight) + (sectionHeight / 2);
            
            const varianceX = (Math.random() - 0.5) * sectionWidth * variance;
            const varianceY = (Math.random() - 0.5) * sectionHeight * variance;
            
            const x = Math.max(margin, Math.min(viewportWidth - margin - CONFIG.DIAMOND.SIZE, 
                baseCenterX + varianceX));
            const y = Math.max(margin, Math.min(viewportHeight - margin - CONFIG.DIAMOND.SIZE, 
                baseCenterY + varianceY));
            
            positions.push({ x, y });
        }

        return positions;
    }

    /**
     * Render all diamonds on the page
     */
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

    /**
     * Display next diamond with animation
     */
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

    /**
     * Create animated arrow pointing to diamond
     */
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

    /**
     * Handle diamond click event
     */
    async function handleDiamondClick(subtaskId) {
        if (state.isProcessing) return;
        
        const clickedDiamond = state.diamondElements[state.currentDiamondIndex];
        const clickedSubtaskId = clickedDiamond.getAttribute('data-subtask-id');
        
        if (clickedSubtaskId !== subtaskId) return;
        
        state.isProcessing = true;
        
        // Disable pointer events on all diamonds
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

            if (result.success) {
                state.completedTasks.push(subtaskId);
                clickedDiamond.remove();

                await Swal.fire({
                    title: 'Success!',
                    text: 'Task completed successfully',
                    icon: 'success',
                    timer: CONFIG.TIMING.SUCCESS_DURATION,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    allowOutsideClick: false
                });

                if (state.currentDiamondIndex < state.diamondElements.length - 1) {
                    displayNextDiamond();
                    state.isProcessing = false;
                    const diamondElements = document.querySelectorAll('.seotize-diamond');
                    diamondElements.forEach(el => el.style.pointerEvents = 'auto');
                } else {
                    await Swal.fire({
                        title: 'All Tasks Completed!',
                        text: 'Congratulations! Redirecting to your wallet...',
                        icon: 'success',
                        timer: CONFIG.TIMING.COMPLETION_DURATION,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false
                    });
                    
                    window.location.href = 'https://seotize.net/partner/dashboard/wallet/?status=reward';
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
            
            // Re-enable pointer events
            const diamondElements = document.querySelectorAll('.seotize-diamond');
            diamondElements.forEach(el => el.style.pointerEvents = 'auto');
        }
    }

    // ============================================================================
    // STYLES
    // ============================================================================
    
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes seotizeDiamondGlow {
                0%, 100% {
                    fill: #3b82f6;
                }
                25% {
                    fill: #8b5cf6;
                }
                50% {
                    fill: #ec4899;
                }
                75% {
                    fill: #f59e0b;
                }
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

            /* Custom Swal styling */
            .swal2-popup {
                border-radius: 16px !important;
                padding: 2rem !important;
            }

            .swal2-title {
                font-size: 1.75rem !important;
                font-weight: 700 !important;
                color: #1f2937 !important;
            }

            .swal2-html-container {
                font-size: 1.1rem !important;
                color: #6b7280 !important;
            }

            .swal2-timer-progress-bar {
                background: linear-gradient(90deg, #3b82f6, #8b5cf6) !important;
            }
        `;
        domCache.head.appendChild(style);
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    
    /**
     * Initialize the Seotize engine
     */
    async function initializeEngine() {
        try {
            // Generate unique ID using dashboard method
            state.uniqueId = getUniqueId();
            
            // Wait for turnstile token
            const token = await waitForTurnstileToken();
            
            // Fetch tasks
            const data = await fetchPartnerSubtasks(state.uniqueId, token);
            
            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                return;
            }

            // Store incomplete tasks
            state.diamonds = data.subtasks_info
                .filter(task => task.status === 'incomplete')
                .map(task => task.subtask_id);

            if (state.diamonds.length === 0) {
                Swal.fire({
                    title: 'All Done!',
                    text: 'You have already completed all tasks.',
                    icon: 'info'
                });
                return;
            }

            // Show welcome message
            await Swal.fire({
                title: 'Welcome Seotize Partner!',
                html: 'Thank you for starting the task. Follow the animated arrow to find and click on the diamonds.',
                timer: CONFIG.TIMING.WELCOME_DURATION,
                timerProgressBar: true,
                showConfirmButton: false,
                allowOutsideClick: false
            });

            // Render and display diamonds
            renderDiamonds();
            displayNextDiamond();

        } catch (error) {
            console.error('Seotize initialization error:', error);
        }
    }

    /**
     * Setup Turnstile widget
     */
    function setupTurnstile() {
        const div = document.createElement('div');
        div.className = 'cf-turnstile';
        div.setAttribute('data-theme', 'light');
        div.setAttribute('data-sitekey', state.systemId);
        Object.assign(div.style, {
            border: 'none',
            margin: '0 auto',
            display: 'block',
            textAlign: 'center',
            padding: '15px 0'
        });
        
        domCache.body.insertBefore(div, domCache.body.firstChild);
    }

    /**
     * Load all required dependencies
     */
    async function loadDependencies() {
        try {
            // Load scripts in parallel for better performance
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

    /**
     * Main bootstrap function
     */
    async function bootstrap() {
        // Initialize DOM cache now that we're sure DOM is ready
        domCache = {
            body: document.body,
            head: document.head
        };

        // Get engine script tag
        const engineScript = getEngineScriptTag();
        
        if (!engineScript) {
            console.error('Seotize engine script not found.');
            return;
        }

        // Extract system ID
        const queryString = engineScript.src.split('?')[1];
        state.systemId = getURLParameter(queryString, 'id');

        if (!state.systemId) {
            console.error('System ID not found in script tag.');
            return;
        }

        // Expose to window for turnstile callback
        window.SYSYID = state.systemId;

        // Only run if referred from Google
        if (!document.referrer.includes('google.com')) {
            return;
        }

        // Inject styles
        injectStyles();

        // Load dependencies
        const loaded = await loadDependencies();
        if (!loaded) return;

        // Setup Turnstile widget
        setupTurnstile();
    }

    // ============================================================================
    // GLOBAL CALLBACK
    // ============================================================================
    
    // Expose callback for Turnstile
    window.onloadTurnstileCallback = function() {
        initializeEngine();
    };

    // ============================================================================
    // START
    // ============================================================================
    
    // Auto-start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }

})();
