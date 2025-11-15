// Wrap in an IIFE (Immediately Invoked Function Expression) to avoid polluting the client's global scope
(() => {
    
    // === 1. CONFIGURATION ===
    
    // Get the client's site URL from the script tag parameter
    const scriptTag = document.querySelector('script[src*="blog.js"]');
    if (!scriptTag) {
        console.error('Seotize Blog: Could not find script tag.');
        return;
    }
    const scriptSrc = new URL(scriptTag.src);
    const SITE_URL = scriptSrc.searchParams.get('site');
    
    if (!SITE_URL) {
        console.error('Seotize Blog: "site" parameter is missing in the script URL. e.g., <script src=".../blog.js?site=your-domain.com">');
        return;
    }

    // Find the element to inject the blog into
    const rootElement = document.getElementById('seotize-blog-root');
    if (!rootElement) {
        console.error('Seotize Blog: Could not find element with id="seotize-blog-root".');
        return;
    }

    const API_BASE = 'https://api.seotize.net/articles';

    
    // === 2. HELPER FUNCTIONS TO INJECT DEPENDENCIES ===

    function loadStyle(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }

    function loadScript(src, defer = true, isAsync = false) {
        const script = document.createElement('script');
        script.src = src;
        script.defer = defer;
        script.async = isAsync;
        document.head.appendChild(script);
    }
    
    // === 3. INJECT ALL CSS, STYLES, AND LIBRARIES ===

    // Load external CSS libraries
    loadStyle('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Poppins:wght@400;500;600;700&display=swap');
    loadStyle('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css');
    loadStyle('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css');

    // Inject custom styles as an inline <style> block
    const customStyles = `
        :root { --brand-primary: #2563eb; --brand-accent: #f97316; }
        #seotize-blog-root body { font-family: 'poppins', sans-serif; }
        .spinner { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: var(--brand-primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .blog-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .blog-card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); }
        .page-btn { min-width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #e5e7eb; background: white; color: #6b7280; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        .page-btn:hover:not(:disabled) { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }
        .page-btn.active { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .modal-image-slider .swiper-button-next, .modal-image-slider .swiper-button-prev { color: white; background: rgba(0, 0, 0, 0.3); width: 44px !important; height: 44px !important; border-radius: 50%; }
        .modal-image-slider .swiper-button-next:after, .modal-image-slider .swiper-button-prev:after { font-size: 20px !important; }
        .modal-image-slider .swiper-pagination-bullet { background: white; opacity: 0.7; }
        .modal-image-slider .swiper-pagination-bullet-active { opacity: 1; background: var(--brand-accent); }
        .article-content h2 { font-family: 'montserrat', sans-serif; font-size: 1.75rem; font-weight: 700; margin: 2.5rem 0 1.5rem; }
        .article-content h3 { font-family: 'montserrat', sans-serif; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem; }
        .article-content p { margin-bottom: 1.5rem; line-height: 1.8; }
        .article-content ul, .article-content ol { margin: 1.5rem 0; padding-left: 2rem; }
        .article-content li { margin: 0.75rem 0; }
        .article-content a { color: var(--brand-primary); text-decoration: underline; }
    `;
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = customStyles;
    document.head.appendChild(styleSheet);
    
    // Inject Tailwind config *before* Tailwind itself is loaded
    const tailwindConfig = document.createElement('script');
    tailwindConfig.innerHTML = `
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: 'var(--brand-primary)',
                        accent: 'var(--brand-accent)',
                        dark: '#1f2937',
                        light: '#f8fafc'
                    },
                    fontFamily: {
                        'montserrat': ['Montserrat', 'sans-serif'],
                        'poppins': ['Poppins', 'sans-serif'],
                    }
                }
            }
        }
    `;
    document.head.appendChild(tailwindConfig);

    // Load external JS libraries
    loadScript('https://cdn.tailwindcss.com', true, false);
    loadScript('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js', true, false);


    // === 4. INJECT THE BLOG'S HTML STRUCTURE ===
    
    const blogHTML = `
        <div class="font-poppins text-gray-800 bg-light">
            <section class="blog-hero pt-20 pb-16 bg-light">
                <div class="container mx-auto px-4">
                    <h1 class="text-4xl md:text-5xl font-bold text-primary font-montserrat text-center mb-4">
                        Our Latest Insights
                    </h1>
                    <p class="text-xl text-gray-700 text-center max-w-3xl mx-auto">
                        Discover the latest news, trends, and articles.
                    </p>
                </div>
            </section>

            <section class="py-16 bg-white">
                <div class="container mx-auto px-4">
                    <div id="loading" class="hidden flex justify-center py-20">
                        <div class="spinner"></div>
                        <p class="ml-4 text-gray-600 text-lg">Loading articles...</p>
                    </div>
                    <div id="blogGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"></div>
                    <div id="noResults" class="hidden text-center py-12">
                        <i class="fas fa-inbox text-4xl text-gray-300 mb-4"></i>
                        <h3 class="text-2xl font-bold text-gray-700 mb-3">No articles yet</h3>
                        <p class="text-gray-500">Check back soon for new content.</p>
                    </div>
                    <div id="pagination" class="pagination flex justify-center items-center gap-2 mt-16"></div>
                </div>
            </section>

            <div id="articleModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-50 items-center justify-center p-0 md:p-4" style="z-index: 1000;">
                <div class="bg-white rounded-none md:rounded-lg shadow-2xl w-full h-full md:max-w-6xl md:h-[90vh] flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4 border-b bg-light">
                        <h1 id="modalTitle" class="text-xl md:text-2xl font-bold text-primary font-montserrat truncate pr-4"></h1>
                        <button class="text-gray-500 hover:text-red-500" onclick="closeModal()">
                            <i class="fas fa-times text-2xl"></i>
                        </button>
                    </div>
                    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
                        <div class="hidden md:block md:w-1/3 md:max-w-sm bg-light md:border-r overflow-y-auto p-4">
                            <h3 class="text-xl font-semibold text-primary mb-4">Related Articles</h3>
                            <div id="relatedArticles" class="space-y-4"></div>
                        </div>
                        <div class="flex-1 overflow-y-auto">
                            <div class="swiper modal-image-slider h-64 md:h-96 bg-gray-100">
                                <div class="swiper-wrapper" id="modalSliderWrapper"></div>
                                <div class="swiper-pagination"></div>
                                <div class="swiper-button-next"></div>
                                <div class="swiper-button-prev"></div>
                            </div>
                            <div class="p-6 border-b">
                                <span id="modalCategory" class="inline-block bg-accent text-white text-sm font-semibold px-3 py-1 rounded-full mb-4"></span>
                                <div class="flex items-center text-gray-600 text-sm">
                                    <span id="modalDate" class="flex items-center"><i class="far fa-calendar mr-2 text-primary"></i></span>
                                </div>
                            </div>
                            <div class="article-content p-6" id="modalContent"></div>
                            <div class="md:hidden bg-light border-t p-4">
                                <h3 class="text-xl font-semibold text-primary mb-4">Related Articles</h3>
                                <div id="relatedArticlesMobile" class="space-y-4"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    rootElement.innerHTML = blogHTML;

    
    // === 5. APPLICATION LOGIC (The 'Brain') ===
    
    let currentPage = 1;
    let totalPages = 1;
    let articles = [];
    let modalSwiper = null;

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    async function loadArticles(page = 1) {
        const loading = document.getElementById('loading');
        const blogGrid = document.getElementById('blogGrid');
        const noResults = document.getElementById('noResults');
        const pagination = document.getElementById('pagination');

        if (loading) loading.classList.remove('hidden');
        if (blogGrid) blogGrid.innerHTML = '';
        if (noResults) noResults.classList.add('hidden');
        if (pagination) pagination.innerHTML = '';

        try {
            const url = `${API_BASE}?url=${SITE_URL}/&page=${page}&page_size=9`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.code === 200 && data.data && data.data.articles) {
                articles = data.data.articles;
                currentPage = data.data.pagination?.current || 1;
                totalPages = data.data.pagination?.pages || 1;

                if (articles.length === 0) {
                    if (noResults) noResults.classList.remove('hidden');
                } else {
                    renderArticles();
                    if (totalPages > 1) renderPagination();
                }
            } else {
                if (noResults) noResults.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading articles:', error);
            if (noResults) noResults.classList.remove('hidden');
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    }

    function renderArticles() {
        const blogGrid = document.getElementById('blogGrid');
        if (!blogGrid) return;

        blogGrid.innerHTML = '';
        articles.forEach((article) => {
            const card = document.createElement('div');
            card.className = 'blog-card bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer';
            card.onclick = () => openArticle(article.article_id);
            const imageUrl = article.images && article.images.length > 0 ? article.images[0] : 'https://via.placeholder.com/400x250?text=Read+More';

            card.innerHTML = `
                <div class="relative h-56 overflow-hidden bg-gray-200">
                    <img src="${imageUrl}" alt="${article.subject}" class="w-full h-full object-cover" loading="lazy">
                </div>
                <div class="p-6">
                    <div class="flex items-center text-sm text-gray-500 mb-3">
                        <i class="far fa-calendar-alt mr-2 text-primary"></i>
                        <span>${formatDate(article.creation_time)}</span>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3 hover:text-primary transition-colors line-clamp-2">${article.subject}</h3>
                    <span class="inline-flex items-center text-accent hover:text-primary transition-colors font-semibold">
                        Read Article <i class="fas fa-arrow-right ml-2"></i>
                    </span>
                </div>
            `;
            blogGrid.appendChild(card);
        });
    }

    function renderPagination() {
        const pagination = document.getElementById('pagination');
        if (!pagination || totalPages <= 1) return;

        pagination.innerHTML = '';
        // Previous
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => { if (currentPage > 1) loadArticles(currentPage - 1); };
        pagination.appendChild(prevBtn);

        // Pages
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => loadArticles(i);
            pagination.appendChild(pageBtn);
        }

        // Next
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => { if (currentPage < totalPages) loadArticles(currentPage + 1); };
        pagination.appendChild(nextBtn);
    }

    // Must attach functions to 'window' so inline 'onclick' attributes can find them
    window.openArticle = async function(articleId) {
        const modal = document.getElementById('articleModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';

        document.getElementById('modalTitle').textContent = 'Loading...';
        document.getElementById('modalContent').innerHTML = '<div class="spinner mx-auto my-10"></div>';
        document.getElementById('modalSliderWrapper').innerHTML = '';
        document.getElementById('relatedArticles').innerHTML = '';
        document.getElementById('relatedArticlesMobile').innerHTML = '';

        try {
            const url = `${API_BASE}?url=${SITE_URL}/&article_id=${articleId}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.code === 200 && data.data?.article) {
                const article = data.data.article;
                document.getElementById('modalTitle').textContent = article.subject;
                document.getElementById('modalDate').innerHTML = `<i class="far fa-calendar mr-2 text-primary"></i>${formatDate(article.creation_time)}`;
                document.getElementById('modalCategory').textContent = "Article";
                
                const images = article.images && article.images.length > 0 ? article.images : ['https://via.placeholder.com/800x400?text=Article'];
                document.getElementById('modalSliderWrapper').innerHTML = images.map(img => `
                    <div class="swiper-slide flex items-center justify-center bg-gray-200">
                        <img src="${img}" alt="${article.subject}" class="w-full h-full object-cover">
                    </div>`).join('');

                if (modalSwiper) modalSwiper.destroy(true, true);
                // Check if Swiper is loaded
                if (typeof Swiper !== 'undefined') {
                    modalSwiper = new Swiper('.modal-image-slider', {
                        loop: images.length > 1,
                        pagination: { el: '.modal-image-slider .swiper-pagination', clickable: true },
                        navigation: { nextEl: '.modal-image-slider .swiper-button-next', prevEl: '.modal-image-slider .swiper-button-prev' },
                    });
                }

                document.getElementById('modalContent').innerHTML = article.body;
                
                // Related articles
                const otherArticles = articles.filter(a => a.article_id !== articleId).slice(0, 3);
                const relatedHTML = otherArticles.length > 0 ? otherArticles.map(a => `
                    <div class="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer" onclick="openArticle('${a.article_id}')">
                        <img src="${a.images?.[0] || 'https://via.placeholder.com/300x150'}" alt="${a.subject}" class="w-full h-24 object-cover">
                        <div class="p-3">
                            <h4 class="font-semibold text-sm text-primary line-clamp-2">${a.subject}</h4>
                        </div>
                    </div>`).join('') : '<p class="text-sm text-gray-500">No related articles.</p>';
                
                document.getElementById('relatedArticles').innerHTML = relatedHTML;
                document.getElementById('relatedArticlesMobile').innerHTML = relatedHTML;
                
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('id', articleId);
                window.history.pushState({}, '', newUrl);
            }
        } catch (error) {
            console.error('Error loading article:', error);
            document.getElementById('modalContent').innerHTML = '<p class="text-red-500 p-6">Error loading article.</p>';
        }
    }

    window.closeModal = function() {
        const modal = document.getElementById('articleModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
        if (modalSwiper) {
            modalSwiper.destroy(true, true);
            modalSwiper = null;
        }
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('id');
        window.history.pushState({}, '', newUrl);
    }
    
    // === 6. INITIALIZATION ===
    
    // Run the app once the DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        loadArticles();

        // Check for article ID in URL on load
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        if (articleId) {
            // Use a timeout to ensure Swiper and other libs are loaded
            setTimeout(() => openArticle(articleId), 1000);
        }
    });

})(); // End of IIFE
