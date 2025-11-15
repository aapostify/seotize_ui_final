// Seotize Blog Loader v1.1
// Wraps all code in an IIFE to prevent conflicts with the host page's scripts.
(() => {
    
    // === 1. CONFIGURATION ===
    
    // Find its own script tag to read the 'site' parameter
    const scriptTag = document.querySelector('script[src*="blog.js"]');
    if (!scriptTag) {
        console.error('Seotize Blog: Could not find script tag. Make sure it has "blog.js" in the src.');
        return;
    }
    
    let scriptSrc;
    try {
        scriptSrc = new URL(scriptTag.src);
    } catch (e) {
        console.error('Seotize Blog: Script source URL is invalid.');
        return;
    }

    const SITE_URL = scriptSrc.searchParams.get('site');
    
    if (!SITE_URL) {
        console.error('Seotize Blog: "site" parameter is missing in the script URL. e.g., <script src=".../blog.js?site=your-domain.com">');
        return;
    }

    // Find the root element where the blog will be injected
    const rootElement = document.getElementById('seotize-blog-root');
    if (!rootElement) {
        console.error('Seotize Blog: Could not find element with id="seotize-blog-root". Please add <div id="seotize-blog-root"></div> to your page.');
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
    // These styles are scoped with #seotize-blog-root to minimize conflicts
    const customStyles = `
        :root { 
            --brand-primary: #2563eb; 
            --brand-accent: #f97316; 
            --brand-dark: #1f2937;
        }
        #seotize-blog-root { 
            font-family: 'poppins', sans-serif; 
            color: #374151; /* Default text color */
        }
        #seotize-blog-root .spinner { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: var(--brand-primary); border-radius: 50%; animation: spin-seotize 1s linear infinite; }
        @keyframes spin-seotize { to { transform: rotate(360deg); } }
        #seotize-blog-root .blog-card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        #seotize-blog-root .blog-card:hover { transform: translateY(-5px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); }
        #seotize-blog-root .page-btn { min-width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #e5e7eb; background: white; color: #6b7280; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        #seotize-blog-root .page-btn:hover:not(:disabled) { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }
        #seotize-blog-root .page-btn.active { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }
        #seotize-blog-root .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        #seotize-blog-root .modal-image-slider .swiper-button-next, 
        #seotize-blog-root .modal-image-slider .swiper-button-prev { color: white; background: rgba(0, 0, 0, 0.3); width: 44px !important; height: 44px !important; border-radius: 50%; backdrop-filter: blur(5px); }
        #seotize-blog-root .modal-image-slider .swiper-button-next:after, 
        #seotize-blog-root .modal-image-slider .swiper-button-prev:after { font-size: 20px !important; }
        #seotize-blog-root .modal-image-slider .swiper-pagination-bullet { background: white; opacity: 0.7; }
        #seotize-blog-root .modal-image-slider .swiper-pagination-bullet-active { opacity: 1; background: var(--brand-accent); }
        #seotize-blog-root .article-content h2 { font-family: 'montserrat', sans-serif; color: var(--brand-dark); font-size: 1.75rem; font-weight: 700; margin: 2.5rem 0 1.5rem; }
        #seotize-blog-root .article-content h3 { font-family: 'montserrat', sans-serif; color: #374151; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem; }
        #seotize-blog-root .article-content p { margin-bottom: 1.5rem; line-height: 1.8; color: #4b5568; }
        #seotize-blog-root .article-content ul, 
        #seotize-blog-root .article-content ol { margin: 1.5rem 0; padding-left: 2rem; }
        #seotize-blog-root .article-content li { margin: 0.75rem 0; color: #4b5568; }
        #seotize-blog-root .article-content a { color: var(--brand-primary); text-decoration: underline; transition: color 0.3s ease; }
        #seotize-blog-root .article-content a:hover { color: var(--brand-accent); }
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
                        dark: 'var(--brand-dark)',
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
            <!-- Hero Section -->
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

            <!-- Blog Grid Section -->
            <section id="seotize-blog-container" class="py-16 bg-white" style="scroll-margin-top: 80px;">
                <div class="container mx-auto px-4">
                    <div id="loading" class="hidden flex justify-center py-20">
                        <div class="spinner"></div>
                        <p class="ml-4 text-gray-600 text-lg">Loading articles...</p>
                    </div>
                    <div id="blogGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"></div>
                    <div id="noResults" class="hidden text-center py-12">
                        <div class="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                            <i class="fas fa-inbox text-3xl text-gray-400"></i>
                        </div>
                        <h3 class="text-2xl font-bold text-gray-700 mb-3">No articles yet</h3>
                        <p class="text-gray-500 max-w-md mx-auto">We're working on amazing content. Check back soon for new insights and updates.</p>
                    </div>
                    <div id="pagination" class="pagination flex justify-center items-center gap-2 mt-16"></div>
                </div>
            </section>

            <!-- Article Modal -->
            <div id="articleModal" class="hidden fixed inset-0 bg-black/80 backdrop-blur-sm p-0 md:p-4" style="z-index: 9999;">
                <div class="bg-white rounded-none md:rounded-lg shadow-2xl w-full h-full md:max-w-6xl md:h-[90vh] flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4 border-b bg-light sticky top-0">
                        <h1 id="modalTitle" class="text-xl md:text-2xl font-bold text-primary font-montserrat truncate pr-4"></h1>
                        <button class="text-gray-500 hover:text-red-500 transition-transform transform hover:rotate-90" onclick="seotizeBlog.closeModal()">
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
    
    // Global state for the blog instance
    let currentPage = 1;
    let totalPages = 1;
    let articles = [];
    let modalSwiper = null;

    // Get the blog container for scrolling
    const blogContainer = document.getElementById('seotize-blog-container');

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
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            const data = await response.json();

            if (data.code === 200 && data.data && data.data.articles) {
                articles = data.data.articles;
                currentPage = data.data.pagination?.current || 1;
                totalPages = data.data.pagination?.pages || 1; // This is the key line

                if (articles.length === 0) {
                    if (noResults) noResults.classList.remove('hidden');
                } else {
                    renderArticles();
                    if (totalPages > 1) {
                        renderPagination();
                    }
                }
            } else {
                throw new Error(data.message || 'Failed to load articles');
            }
        } catch (error) {
            console.error('Seotize Blog: Error loading articles:', error);
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
            card.className = 'blog-card bg-white rounded-lg shadow-lg overflow-hidden cursor-pointer group';
            card.onclick = () => seotizeBlog.openArticle(article.article_id);
            const imageUrl = article.images && article.images.length > 0 ? article.images[0] : 'https://placehold.co/400x250/e2e8f0/64748b?text=Read+More';

            card.innerHTML = `
                <div class="relative h-56 overflow-hidden bg-gray-200">
                    <img src="${imageUrl}" alt="${article.subject}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" onerror="this.src='https://placehold.co/400x250/fecaca/991b1b?text=Image+Error'">
                </div>
                <div class="p-6">
                    <div class="flex items-center text-sm text-gray-500 mb-3">
                        <i class="far fa-calendar-alt mr-2 text-primary"></i>
                        <span>${formatDate(article.creation_time)}</span>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3 hover:text-primary transition-colors line-clamp-2">${article.subject}</h3>
                    <span class="inline-flex items-center text-accent hover:text-primary transition-colors font-semibold">
                        Read Article <i class="fas fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i>
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
        
        // Helper function for page clicks
        const handlePageClick = (newPage) => {
            if (newPage >= 1 && newPage <= totalPages) {
                loadArticles(newPage);
                // **FIX**: Scroll to top of blog container
                if (blogContainer) {
                    blogContainer.scrollIntoView({ behavior: 'smooth' });
                }
            }
        };

        // Previous
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => handlePageClick(currentPage - 1);
        pagination.appendChild(prevBtn);

        // Page Numbers
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            // Use a closure to capture the correct page number 'i'
            pageBtn.onclick = ((pageIndex) => {
                return () => handlePageClick(pageIndex);
            })(i);
            pagination.appendChild(pageBtn);
        }

        // Next
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => handlePageClick(currentPage + 1);
        pagination.appendChild(nextBtn);
    }

    // We create a global object 'seotizeBlog' to safely expose functions
    // to inline 'onclick' attributes without polluting 'window' directly.
    window.seotizeBlog = {
        openArticle: async function(articleId) {
            const modal = document.getElementById('articleModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.body.style.overflow = 'hidden';

            // Reset modal content
            document.getElementById('modalTitle').textContent = 'Loading...';
            document.getElementById('modalContent').innerHTML = '<div class="spinner mx-auto my-10"></div>';
            document.getElementById('modalSliderWrapper').innerHTML = '';
            document.getElementById('relatedArticles').innerHTML = '';
            document.getElementById('relatedArticlesMobile').innerHTML = '';

            try {
                const url = `${API_BASE}?url=${SITE_URL}/&article_id=${articleId}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`API error ${response.status}`);
                const data = await response.json();

                if (data.code === 200 && data.data?.article) {
                    const article = data.data.article;
                    document.getElementById('modalTitle').textContent = article.subject;
                    document.getElementById('modalDate').innerHTML = `<i class="far fa-calendar mr-2 text-primary"></i>${formatDate(article.creation_time)}`;
                    document.getElementById('modalCategory').textContent = "Article";
                    
                    const images = article.images && article.images.length > 0 ? article.images : ['https://placehold.co/800x400/e2e8f0/64748b?text=Article'];
                    document.getElementById('modalSliderWrapper').innerHTML = images.map(img => `
                        <div class="swiper-slide flex items-center justify-center bg-gray-200">
                            <img src="${img}" alt="${article.subject}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/800x400/fecaca/991b1b?text=Image+Not+Available'">
                        </div>`).join('');

                    if (modalSwiper) modalSwiper.destroy(true, true);
                    
                    // Check if Swiper library is loaded
                    if (typeof Swiper !== 'undefined') {
                        modalSwiper = new Swiper('.modal-image-slider', {
                            loop: images.length > 1,
                            pagination: { el: '.modal-image-slider .swiper-pagination', clickable: true },
                            navigation: { nextEl: '.modal-image-slider .swiper-button-next', prevEl: '.modal-image-slider .swiper-button-prev' },
                            autoplay: { delay: 4000, disableOnInteraction: false }
                        });
                    } else {
                        console.warn('Seotize Blog: Swiper library not loaded, slider will not work.');
                    }

                    document.getElementById('modalContent').innerHTML = article.body;
                    
                    // Related articles
                    const otherArticles = articles.filter(a => a.article_id !== articleId).slice(0, 3);
                    const relatedHTML = otherArticles.length > 0 ? otherArticles.map(a => `
                        <div class="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition" onclick="seotizeBlog.openArticle('${a.article_id}')">
                            <img src="${a.images?.[0] || 'https://placehold.co/300x150/e2e8f0/64748b?text=Related'}" alt="${a.subject}" class="w-full h-24 object-cover">
                            <div class="p-3">
                                <h4 class="font-semibold text-sm text-primary line-clamp-2">${a.subject}</h4>
                                <p class="text-xs text-gray-500 mt-1">${formatDate(a.creation_time)}</p>
                            </div>
                        </div>`).join('') : '<p class="text-sm text-gray-500">No related articles found.</p>';
                    
                    document.getElementById('relatedArticles').innerHTML = relatedHTML;
                    document.getElementById('relatedArticlesMobile').innerHTML = relatedHTML;
                    
                    // Update URL for deep-linking
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set('id', articleId);
                    window.history.pushState({ articleId: articleId }, '', newUrl);

                } else {
                    throw new Error(data.message || 'Article data format error');
                }
            } catch (error) {
                console.error('Seotize Blog: Error loading article:', error);
                document.getElementById('modalContent').innerHTML = '<p class="text-red-500 p-6">Error loading article. Please try again later.</p>';
            }
        },

        closeModal: function() {
            const modal = document.getElementById('articleModal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            document.body.style.overflow = '';
            if (modalSwiper) {
                modalSwiper.destroy(true, true);
                modalSwiper = null;
            }
            // Clear article ID from URL
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('id');
            window.history.pushState({}, '', newUrl);
        }
    };
    
    // === 6. INITIALIZATION ===
    
    // Handle browser back/forward navigation for modal
    window.addEventListener('popstate', (event) => {
        const params = new URLSearchParams(window.location.search);
        const articleId = params.get('id');
        if (articleId && !document.getElementById('articleModal').classList.contains('flex')) {
            // User navigated forward to an article URL
            seotizeBlog.openArticle(articleId);
        } else if (!articleId && document.getElementById('articleModal').classList.contains('flex')) {
            // User navigated back
            seotizeBlog.closeModal();
        }
    });

    // Close modal with ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('articleModal').classList.contains('flex')) {
            seotizeBlog.closeModal();
        }
    });

    // Run the app once the DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        
        // Load the article list first
        loadArticles().then(() => {
            // AFTER the list is loaded, check if we need to open a modal
            if (articleId) {
                // Check if the article is in the list we just fetched
                const articleExists = articles.some(a => a.article_id === articleId);
                if (articleExists) {
                    seotizeBlog.openArticle(articleId);
                } else {
                    // If not in the list (e.g., on page 2, 3...), we still try to fetch it
                    console.warn('Seotize Blog: Article not in initial list, fetching directly.');
                    seotizeBlog.openArticle(articleId);
                }
            }
        });
    });

})(); // End of IIFE
