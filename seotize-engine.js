// Replace the fetchPartnerSubtasks function
async function fetchPartnerSubtasks(uniqueId, url) {
    debugLog('Fetching partner subtasks from API (no captcha required)', 'info');
    debugLog(`Unique ID: ${uniqueId.substring(0, 8)}...`, 'info');
    debugLog(`URL: ${url}`, 'info');
    
    try {
        const response = await fetch(CONFIG.API_ENDPOINTS.GET_TASKS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unique_id: uniqueId,
                url: url
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

// Replace the initializeEngine function
async function initializeEngine() {
    try {
        debugLog('🚀 Starting initialization...', 'info');
        
        await waitForDependencies();

        state.uniqueId = getUniqueId();
        debugLog(`Generated Unique ID: ${state.uniqueId.substring(0, 8)}...`, 'info');
        
        // Get current page URL
        const currentUrl = window.location.href;
        debugLog(`Current URL: ${currentUrl}`, 'info');
        
        // FAST: Fetch tasks immediately WITHOUT Turnstile
        debugLog('⚡ Fast loading: Fetching tasks without captcha', 'info');
        const data = await fetchPartnerSubtasks(state.uniqueId, currentUrl);

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
