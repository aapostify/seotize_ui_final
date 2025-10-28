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
    
    const domCache = {
        body: document.body,
        head: document.head
    };

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
     * Generate browser fingerprint for unique ID
     */
    function generateBrowserFingerprint() {
        const data = [
            navigator.userAgent,
            navigator.language,
            navigator.platform,
            `${screen.width}x${screen.height}`,
            new Date().getTimezoneOffset()
        ].join('|');
        
        return CryptoJS.MD5(data).toString();
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
        svg.innerHTML = '<path d="M0 5.04V4l4-4h8l4 4v1.04L8 16 0 5.04zM2 5l6 8.5L4 5H2zm12 0h-2l-4 8.5L14 5zM6 5l2 6 2-6H6zM4 2L2 4h2l2-2H4zm8 0h-2l2 2h2l-2-2zM7 2L6 4h4L9 2H7z" fill-rule="evenodd"/>';
        
        Object.assign(svg.style, {
            position: 'absolute',
            zIndex: '9999999',
            top: `${yPosition}px`,
            left: `${xPosition}px`,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
        });

        svg.classList.add('seotize-diamond');
        
        // Add click handler
        svg.addEventListener('click', () => handleDiamondClick(subtaskId));
        
        // Add animation
        anime({
            targets: svg,
            easing: 'easeInOutSine',
            duration: 1500,
            loop: true,
            direction: 'alternate',
            scale: [1, 1.2, 1],
            filter: [
                'drop-shadow(0 0 8px rgba(59, 130, 246, 0.8))',
                'drop-shadow(0 0 20px rgba(59, 130, 246, 1))',
                'drop-shadow(0 0 8px rgba(59, 130, 246, 0.8))'
            ]
        });

        return svg;
    }

    /**
     * Generate random positions for diamonds
     */
    function generateDiamondPositions(count) {
        const scrollHeight = Math.max(
            domCache.body.scrollHeight,
            document.documentElement.scrollHeight,
            domCache.body.offsetHeight,
            document.documentElement.offsetHeight
        );

        const viewportWidth = window.innerWidth;
        const { SIZE, MIN_MARGIN, SECTION_VARIANCE } = CONFIG.DIAMOND;
        const sectionHeight = scrollHeight / count;
        const positions = [];

        for (let i = 0; i < count; i++) {
            const sectionStart = i * sectionHeight;
            const sectionEnd = (i + 1) * sectionHeight;
            const sectionCenter = (sectionStart + sectionEnd) / 2;
            const variance = (Math.random() - 0.5) * (sectionHeight * SECTION_VARIANCE);
            
            const yPosition = sectionCenter + variance;
            const xPosition = Math.random() * (viewportWidth - SIZE - MIN_MARGIN * 2) + MIN_MARGIN;

            positions.push({ x: xPosition, y: yPosition });
        }

        return positions;
    }

    /**
     * Render all diamonds on the page
     */
    function renderDiamonds() {
        const positions = generateDiamondPositions(state.diamonds.length);
        
        state.diamondElements = state.diamonds.map((subtaskId, index) => {
            const { x, y } = positions[index];
            const svg = createDiamondSVG(subtaskId, x, y);
            return svg;
        });
    }

    /**
     * Display next diamond in sequence
     */
    function displayNextDiamond() {
        // Remove previous diamonds
        document.querySelectorAll('.seotize-diamond').forEach(el => el.remove());
        
        state.currentDiamondIndex++;
        
        if (state.currentDiamondIndex < state.diamondElements.length) {
            const diamondElement = state.diamondElements[state.currentDiamondIndex];
            domCache.body.appendChild(diamondElement);
            createGuidingArrow(diamondElement);
        } else {
            // All diamonds collected
            removeGuidingArrow();
        }
    }

    // ============================================================================
    // ARROW GUIDE FUNCTIONS
    // ============================================================================
    
    /**
     * Create guiding arrow pointing to target
     */
    function createGuidingArrow(targetElement) {
        removeGuidingArrow();

        const arrow = document.createElement('div');
        Object.assign(arrow.style, {
            position: 'fixed',
            zIndex: '999999999',
            pointerEvents: 'none',
            fontSize: `${CONFIG.ARROW.SIZE}px`,
            transition: 'all 0.3s ease',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
        });
        arrow.className = 'seotize-arrow';
        arrow.innerHTML = '👇';
        
        domCache.body.appendChild(arrow);
        state.currentArrow = arrow;

        // Update arrow position
        const updatePosition = () => {
            if (!targetElement || !targetElement.parentNode) {
                removeGuidingArrow();
                return;
            }

            const rect = targetElement.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;
            
            const isVisible = rect.top >= 0 && rect.bottom <= viewportHeight && 
                             rect.left >= 0 && rect.right <= viewportWidth;

            if (isVisible) {
                arrow.style.top = `${rect.top - CONFIG.ARROW.OFFSET}px`;
                arrow.style.left = `${rect.left + rect.width / 2 - CONFIG.ARROW.SIZE / 2}px`;
                arrow.innerHTML = '👇';
                arrow.style.opacity = '0.9';
            } else if (rect.top < 0) {
                arrow.style.top = '20px';
                arrow.style.left = `${viewportWidth / 2 - CONFIG.ARROW.SIZE / 2}px`;
                arrow.innerHTML = '👆';
                arrow.style.opacity = '1';
            } else if (rect.top > viewportHeight) {
                arrow.style.top = `${viewportHeight - 70}px`;
                arrow.style.left = `${viewportWidth / 2 - CONFIG.ARROW.SIZE / 2}px`;
                arrow.innerHTML = '👇';
                arrow.style.opacity = '1';
            } else if (rect.left < 0) {
                arrow.style.left = '20px';
                arrow.style.top = '50%';
                arrow.innerHTML = '👉';
                arrow.style.opacity = '1';
            } else if (rect.right > viewportWidth) {
                arrow.style.left = `${viewportWidth - 70}px`;
                arrow.style.top = '50%';
                arrow.innerHTML = '👈';
                arrow.style.opacity = '1';
            }
        };

        updatePosition();
        state.arrowUpdateInterval = setInterval(updatePosition, CONFIG.ARROW.UPDATE_INTERVAL);

        // Animate arrow bounce
        anime({
            targets: arrow,
            translateY: [0, 15, 0],
            easing: 'easeInOutSine',
            duration: 1500,
            loop: true
        });

        // Cleanup on click
        targetElement.addEventListener('click', removeGuidingArrow, { once: true });
    }

    /**
     * Remove guiding arrow
     */
    function removeGuidingArrow() {
        if (state.arrowUpdateInterval) {
            clearInterval(state.arrowUpdateInterval);
            state.arrowUpdateInterval = null;
        }

        if (state.currentArrow?.parentNode) {
            state.currentArrow.remove();
            state.currentArrow = null;
        }
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    
    /**
     * Handle diamond click event
     */
    async function handleDiamondClick(subtaskId) {
        if (state.isProcessing) return;
        
        state.isProcessing = true;
        
        try {
            // Disable pointer events
            const diamondElements = document.querySelectorAll('.seotize-diamond');
            diamondElements.forEach(el => el.style.pointerEvents = 'none');
            
            // Reset turnstile
            if (typeof turnstile !== 'undefined') {
                turnstile.reset();
            }
            
            showLoading('Processing...');
            
            // Wait for new turnstile token
            const token = await waitForTurnstileToken();
            
            // Submit task
            const result = await submitTask(subtaskId, token);
            
            closeLoading();
            
            if (result.status === 'success') {
                const remaining = state.diamonds.length - (state.currentDiamondIndex + 1);
                
                if (!result.data.all_tasks_complete) {
                    await Swal.fire({
                        title: `GREAT JOB! ${remaining} MORE!`,
                        html: `You collected a diamond! ${remaining} more to go!`,
                        icon: 'success',
                        timer: CONFIG.TIMING.SUCCESS_DURATION,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        allowOutsideClick: false
                    });
                    
                    displayNextDiamond();
                } else {
                    await Swal.fire({
                        title: 'CONGRATULATIONS!',
                        html: 'You collected all diamonds! Redirecting to dashboard...',
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
            showLoading('Initializing...');
            
            // Generate unique ID
            state.uniqueId = generateBrowserFingerprint();
            
            // Wait for turnstile token
            const token = await waitForTurnstileToken();
            
            // Fetch tasks
            const data = await fetchPartnerSubtasks(state.uniqueId, token);
            
            closeLoading();
            
            if (!data.subtasks_info || data.subtasks_info.length === 0) {
                throw new Error('No tasks available');
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
            closeLoading();
            Swal.fire({
                title: 'Initialization Error',
                text: error.message || 'Failed to initialize',
                icon: 'error',
                confirmButtonText: 'Retry'
            }).then(() => {
                window.location.reload();
            });
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
            alert('Failed to load required resources. Please refresh the page.');
            return false;
        }
    }

    /**
     * Main bootstrap function
     */
    async function bootstrap() {
        // Get engine script tag
        const engineScript = getEngineScriptTag();
        
        if (!engineScript) {
            alert('Seotize engine script not found.');
            return;
        }

        // Extract system ID
        const queryString = engineScript.src.split('?')[1];
        state.systemId = getURLParameter(queryString, 'id');

        if (!state.systemId) {
            alert("System ID not found in script tag.");
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
