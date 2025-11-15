// Seotize Blog Loader v2.0 (No Tailwind)
// This version is self-contained and does NOT require Tailwind CSS.
// Wraps all code in an IIFE to prevent conflicts with the host page's scripts.
(() => {
    
    // === 1. CONFIGURATION ===
    
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

    // Load external CSS libraries (Fonts, Icons, Swiper)
    loadStyle('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Poppins:wght@400;500;600;700&display=swap');
    loadStyle('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css');
    loadStyle('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css');

    // **NEW**: All styles are now included here. No Tailwind needed.
    const customStyles = `
        :root { 
            --brand-primary: #2563eb; 
            --brand-accent: #f97316; 
            --brand-dark: #1f2937;
            --brand-light: #f8fafc;
            --text-primary: #1f2937;
            --text-secondary: #4b5568;
            --text-muted: #6b7280;
        }

        /* Basic Setup */
        #seotize-blog-root { 
            font-family: 'poppins', sans-serif; 
            color: var(--text-primary);
            background-color: var(--brand-light);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        #seotize-blog-root * {
            box-sizing: border-box;
        }
        #seotize-blog-root .container {
            max-width: 1200px;
            margin-left: auto;
            margin-right: auto;
            padding-left: 1rem;
            padding-right: 1rem;
        }

        /* Utility Classes */
        #seotize-blog-root .hidden { display: none !important; }
        #seotize-blog-root .flex { display: flex !important; }
        #seotize-blog-root .justify-center { justify-content: center; }
        #seotize-blog-root .items-center { align-items: center; }
        #seotize-blog-root .text-center { text-align: center; }
        #seotize-blog-root .mx-auto { margin-left: auto; margin-right: auto; }
        #seotize-blog-root .my-10 { margin-top: 2.5rem; margin-bottom: 2.5rem; }
        #seotize-blog-root .mb-4 { margin-bottom: 1rem; }
        #seotize-blog-root .ml-4 { margin-left: 1rem; }
        #seotize-blog-root .pr-4 { padding-right: 1rem; }
        #seotize-blog-root .p-4 { padding: 1rem; }
        #seotize-blog-root .p-6 { padding: 1.5rem; }
        #seotize-blog-root .py-16 { padding-top: 4rem; padding-bottom: 4rem; }
        #seotize-blog-root .py-20 { padding-top: 5rem; padding-bottom: 5rem; }
        #seotize-blog-root .mt-16 { margin-top: 4rem; }
        #seotize-blog-root .text-primary { color: var(--brand-primary); }
        #seotize-blog-root .text-accent { color: var(--brand-accent); }
        #seotize-blog-root .text-red-500 { color: #ef4444; }
        #seotize-blog-root .text-gray-400 { color: #9ca3af; }
        #seotize-blog-root .text-gray-500 { color: var(--text-muted); }
        #seotize-blog-root .text-gray-600 { color: #4b5568; }
        #seotize-blog-root .text-gray-700 { color: #374151; }
        #seotize-blog-root .text-gray-800 { color: var(--text-primary); }
        #seotize-blog-root .text-white { color: #ffffff; }
        #seotize-blog-root .text-sm { font-size: 0.875rem; }
        #seotize-blog-root .text-lg { font-size: 1.125rem; }
        #seotize-blog-root .text-xl { font-size: 1.25rem; }
        #seotize-blog-root .text-2xl { font-size: 1.5rem; }
        #seotize-blog-root .text-3xl { font-size: 1.875rem; }
        #seotize-blog-root .text-4xl { font-size: 2.25rem; }
        #seotize-blog-root .font-bold { font-weight: 700; }
        #seotize-blog-root .font-semibold { font-weight: 600; }
        #seotize-blog-root .font-montserrat { font-family: 'montserrat', sans-serif; }
        #seotize-blog-root .rounded-lg { border-radius: 0.5rem; }
        #seotize-blog-root .rounded-full { border-radius: 9999px; }
        #seotize-blog-root .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); }
        #seotize-blog-root .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
        #seotize-blog-root .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
        #seotize-blog-root .overflow-hidden { overflow: hidden; }
        #seotize-blog-root .cursor-pointer { cursor: pointer; }
        #seotize-blog-root .transition { transition-property: all; transition-duration: 0.3s; transition-timing-function: ease; }
        #seotize-blog-root .hover-shadow-md:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); }
        #seotize-blog-root .hover-text-primary:hover { color: var(--brand-primary); }
        #seotize-blog-root .hover-rotate-90:hover { transform: rotate(90deg); }
        #seotize-blog-root .transform { /* For transitions */ }
        #seotize-blog-root .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #seotize-blog-root .line-clamp-2 { 
            overflow: hidden; 
            display: -webkit-box; 
            -webkit-box-orient: vertical; 
            -webkit-line-clamp: 2; 
        }

        /* Hero */
        .blog-hero {
            padding-top: 5rem;
            padding-bottom: 4rem;
            background-color: var(--brand-light);
        }
        .hero-title {
            font-family: 'montserrat', sans-serif;
            font-size: 2.25rem;
            font-weight: 700;
            text-align: center;
            color: var(--brand-primary);
            margin-bottom: 1rem;
        }
        .hero-subtitle {
            font-size: 1.25rem;
            color: var(--text-secondary);
            text-align: center;
            max-width: 48rem; /* 3xl */
            margin-left: auto;
            margin-right: auto;
        }
        @media (min-width: 768px) {
            .hero-title { font-size: 3rem; } /* 5xl */
        }

        /* Blog Grid */
        #seotize-blog-container {
            background-color: #ffffff;
            scroll-margin-top: 80px; /* For pagination scroll */
        }
        .blog-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 2rem;
        }
        @media (min-width: 768px) {
            .blog-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
            .blog-grid { grid-template-columns: repeat(3, 1fr); }
        }

        /* Blog Card */
        .blog-card {
            background-color: #ffffff;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .blog-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px -3px rgba(0,0,0,0.1), 0 4px 8px -2px rgba(0,0,0,0.05);
        }
        .blog-card-image-wrapper {
            position: relative;
            height: 14rem; /* 56 */
            overflow: hidden;
            background-color: #e5e7eb;
        }
        .blog-card-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s ease;
        }
        .blog-card:hover .blog-card-image {
            transform: scale(1.1);
        }
        .blog-card-content { padding: 1.5rem; }
        .blog-card-date {
            display: flex;
            align-items: center;
            font-size: 0.875rem;
            color: var(--text-muted);
            margin-bottom: 0.75rem;
        }
        .blog-card-date i { margin-right: 0.5rem; color: var(--brand-primary); }
        .blog-card-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 0.75rem;
            transition: color 0.3s ease;
            /* line-clamp */
            overflow: hidden; 
            display: -webkit-box; 
            -webkit-box-orient: vertical; 
            -webkit-line-clamp: 2;
        }
        .blog-card:hover .blog-card-title { color: var(--brand-primary); }
        .blog-card-readmore {
            display: inline-flex;
            align-items: center;
            color: var(--brand-accent);
            font-weight: 600;
            transition: color 0.3s ease;
        }
        .blog-card:hover .blog-card-readmore { color: var(--brand-primary); }
        .blog-card-readmore i {
            margin-left: 0.5rem;
            transition: transform 0.3s ease;
        }
        .blog-card:hover .blog-card-readmore i { transform: translateX(4px); }

        /* No Results */
        .no-results { text-align: center; padding-top: 3rem; padding-bottom: 3rem; }
        .no-results-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 5rem;
            height: 5rem;
            background-color: #f3f4f6;
            border-radius: 9999px;
            margin-bottom: 1.5rem;
        }
        .no-results-icon i { font-size: 1.875rem; color: #9ca3af; }
        .no-results h3 { font-size: 1.5rem; font-weight: 700; color: #374151; margin-bottom: 0.75rem; }
        .no-results p { color: var(--text-muted); max-width: 36rem; margin: 0 auto; }

        /* Spinner */
        .spinner-wrapper { display: flex; justify-content: center; padding-top: 5rem; padding-bottom: 5rem; }
        .spinner { width: 48px; height: 48px; border: 4px solid #e5e7eb; border-top-color: var(--brand-primary); border-radius: 50%; animation: spin-seotize 1s linear infinite; }
        @keyframes spin-seotize { to { transform: rotate(360deg); } }

        /* Pagination */
        .pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 4rem; }
        .page-btn { min-width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; border: 1px solid #e5e7eb; background: white; color: var(--text-muted); font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        .page-btn:hover:not(:disabled) { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }
        .page-btn.active { background: var(--brand-primary); color: white; border-color: var(--brand-primary); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Modal */
        .modal-overlay {
            position: fixed;
            inset: 0;
            background-color: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
        }
        .modal-container {
            background-color: #ffffff;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        @media (min-width: 768px) {
            .modal-overlay { padding: 1rem; }
            .modal-container { border-radius: 0.5rem; max-width: 64rem; height: 90vh; }
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #e5e7eb;
            background-color: var(--brand-light);
            position: sticky;
            top: 0;
        }
        .modal-title {
            font-family: 'montserrat', sans-serif;
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--brand-primary);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            padding-right: 1rem;
        }
        .modal-close-btn {
            color: var(--text-muted);
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.5rem;
            transition: transform 0.3s ease, color 0.3s ease;
        }
        .modal-close-btn:hover { color: #ef4444; transform: rotate(90deg); }
        
        .modal-body-flex {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        @media (min-width: 768px) {
            .modal-body-flex { flex-direction: row; }
        }
        
        .modal-sidebar {
            background-color: var(--brand-light);
            border-right: 1px solid #e5e7eb;
            overflow-y: auto;
            padding: 1rem;
            display: none; /* Hidden on mobile */
        }
        @media (min-width: 768px) {
            .modal-sidebar { display: block; width: 33.333%; max-width: 320px; }
        }
        
        .modal-sidebar-mobile { padding: 1rem; background-color: var(--brand-light); border-top: 1px solid #e5e7eb; }
        @media (min-width: 768px) {
            .modal-sidebar-mobile { display: none; }
        }

        .modal-sidebar h3 {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--brand-primary);
            margin-bottom: 1rem;
        }

        .related-card {
            background: #fff;
            border-radius: 0.5rem;
            box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
            overflow: hidden;
            cursor: pointer;
            transition: box-shadow 0.3s ease;
            margin-bottom: 1rem;
        }
        .related-card:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); }
        .related-card img { width: 100%; height: 6rem; object-fit: cover; }
        .related-card-content { padding: 0.75rem; }
        .related-card-title {
            font-weight: 600;
            font-size: 0.875rem;
            color: var(--brand-primary);
            /* line-clamp */
            overflow: hidden; 
            display: -webkit-box; 
            -webkit-box-orient: vertical; 
            -webkit-line-clamp: 2;
        }
        .related-card-date { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }

        .modal-main-content {
            flex-grow: 1;
            overflow-y: auto;
        }

        /* Swiper */
        .modal-image-slider {
            height: 16rem; /* 64 */
            background-color: #e5e7eb;
        }
        .modal-image-slider .swiper-slide {
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: #e5e7eb;
        }
        .modal-image-slider img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        @media (min-width: 768px) {
            .modal-image-slider { height: 24rem; } /* 96 */
        }
        /* Swiper Controls */
        #seotize-blog-root .modal-image-slider .swiper-button-next, 
        #seotize-blog-root .modal-image-slider .swiper-button-prev { color: white; background: rgba(0, 0, 0, 0.3); width: 44px !important; height: 44px !important; border-radius: 50%; backdrop-filter: blur(5px); }
        #seotize-blog-root .modal-image-slider .swiper-button-next:after, 
        #seotize-blog-root .modal-image-slider .swiper-button-prev:after { font-size: 20px !important; }
        #seotize-blog-root .modal-image-slider .swiper-pagination-bullet { background: white; opacity: 0.7; }
        #seotize-blog-root .modal-image-slider .swiper-pagination-bullet-active { opacity: 1; background: var(--brand-accent); }

        /* Article Info */
        .article-info { padding: 1.5rem; border-bottom: 1px solid #e5e7eb; }
        .article-category {
            display: inline-block;
            background-color: var(--brand-accent);
            color: #ffffff;
            font-size: 0.875rem;
            font-weight: 600;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            margin-bottom: 1rem;
        }
        .article-date {
            display: flex;
            align-items: center;
            color: var(--text-muted);
            font-size: 0.875rem;
        }
        .article-date i { margin-right: 0.5rem; color: var(--brand-primary); }

        /* Article Content */
        .article-content { padding: 1.5rem; }
        #seotize-blog-root .article-content h2 { font-family: 'montserrat', sans-serif; color: var(--brand-dark); font-size: 1.75rem; font-weight: 700; margin: 2.5rem 0 1.5rem; }
        #seotize-blog-root .article-content h3 { font-family: 'montserrat', sans-serif; color: #374151; font-size: 1.5rem; font-weight: 600; margin: 2rem 0 1rem; }
        #seotize-blog-root .article-content p { margin-bottom: 1.5rem; line-height: 1.8; color: var(--text-secondary); }
        #seotize-blog-root .article-content ul, 
        #seotize-blog-root .article-content ol { margin: 1.5rem 0; padding-left: 2rem; }
        #seotize-blog-root .article-content li { margin: 0.75rem 0; color: var(--text-secondary); }
        #seotize-blog-root .article-content a { color: var(--brand-primary); text-decoration: underline; transition: color 0.3s ease; }
        #seotize-blog-root .article-content a:hover { color: var(--brand-accent); }
    `;
    const styleSheet = document.createElement('style');
    styleSheet.type = 'text/css';
    styleSheet.innerText = customStyles;
    document.head.appendChild(styleSheet);
    
    // **REMOVED** Tailwind config and script loader

    // Load external JS libraries
    loadScript('https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js', true, false);


    // === 4. INJECT THE BLOG'S HTML STRUCTURE ===
    
    // **NEW**: HTML uses simple, semantic classes instead of Tailwind utilities
    const blogHTML = `
        <div class="seotize-blog-wrapper">
            <!-- Hero Section -->
            <section class="blog-hero">
                <div class="container">
                    <h1 class="hero-title">
                        Our Latest Insights
                    </h1>
                    <p class="hero-subtitle">
                        Discover the latest news, trends, and articles.
                    </p>
                </div>
            </section>

            <!-- Blog Grid Section -->
            <section id="seotize-blog-container" class="py-16">
                <div class="container">
                    <div id="loading" class="spinner-wrapper hidden">
                        <div class="spinner"></div>
                        <p class="ml-4 text-lg text-gray-600">Loading articles...</p>
                    </div>
                    <div id="blogGrid" class="blog-grid"></div>
                    <div id="noResults" class="no-results hidden">
                        <div class="no-results-icon">
                            <i class="fas fa-inbox"></i>
                        </div>
                        <h3>No articles yet</h3>
                        <p>We're working on amazing content. Check back soon for new insights and updates.</p>
                    </div>
                    <div id="pagination" class="pagination"></div>
                </div>
            </section>

            <!-- Article Modal -->
            <div id="articleModal" class="modal-overlay hidden">
                <div class="modal-container">
                    <div class="modal-header">
                        <h1 id="modalTitle" class="modal-title"></h1>
                        <button class="modal-close-btn" onclick="seotizeBlog.closeModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body-flex">
                        <div class="modal-sidebar">
                            <h3>Related Articles</h3>
                            <div id="relatedArticles"></div>
                        </div>
                        <div class="modal-main-content">
                            <div class="swiper modal-image-slider">
                                <div class="swiper-wrapper" id="modalSliderWrapper"></div>
                                <div class="swiper-pagination"></div>
                                <div class="swiper-button-next"></div>
                                <div class="swiper-button-prev"></div>
                            </div>
                            <div class="article-info">
                                <span id="modalCategory" class="article-category"></span>
                                <div class="article-date">
                                    <span id="modalDate"><i class="far fa-calendar"></i></span>
                                </div>
                            </div>
                            <div class="article-content" id="modalContent"></div>
                            <div class="modal-sidebar-mobile">
                                <h3>Related Articles</h3>
                                <div id="relatedArticlesMobile"></div>
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
                
                // **PAGINATION FIX**: Correctly read 'pages' from the API response.
                totalPages = data.data.pagination?.pages || 1; 

                if (articles.length === 0) {
                    if (noResults) noResults.classList.remove('hidden');
                } else {
                    renderArticles();
                    // Only render pagination if there is more than one page
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
            card.className = 'blog-card';
            card.onclick = () => seotizeBlog.openArticle(article.article_id);
            const imageUrl = article.images && article.images.length > 0 ? article.images[0] : 'https://placehold.co/400x250/e2e8f0/64748b?text=Read+More';

            card.innerHTML = `
                <div class="blog-card-image-wrapper">
                    <img src="${imageUrl}" alt="${article.subject}" class="blog-card-image" loading="lazy" onerror="this.src='https://placehold.co/400x250/fecaca/991b1b?text=Image+Error'">
                </div>
                <div class="blog-card-content">
                    <div class="blog-card-date">
                        <i class="far fa-calendar-alt"></i>
                        <span>${formatDate(article.creation_time)}</span>
                    </div>
                    <h3 class="blog-card-title">${article.subject}</h3>
                    <span class="blog-card-readmore">
                        Read Article <i class="fas fa-arrow-right"></i>
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
        
        const handlePageClick = (newPage) => {
            if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
                loadArticles(newPage);
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
        // **PAGINATION FIX**: Simplified the onclick handler.
        // Since 'i' is block-scoped with 'let', we can use it directly.
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => handlePageClick(i);
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

    // Expose functions to the global scope via a single object
    window.seotizeBlog = {
        openArticle: async function(articleId) {
            const modal = document.getElementById('articleModal');
            if (!modal) return;
            modal.classList.remove('hidden');
            modal.classList.add('flex'); // 'flex' is defined in our CSS
            document.body.style.overflow = 'hidden';

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
                    document.getElementById('modalDate').innerHTML = `<i class="far fa-calendar"></i>&nbsp;${formatDate(article.creation_time)}`;
                    document.getElementById('modalCategory').textContent = "Article";
                    
                    const images = article.images && article.images.length > 0 ? article.images : ['https://placehold.co/800x400/e2e8f0/64748b?text=Article'];
                    document.getElementById('modalSliderWrapper').innerHTML = images.map(img => `
                        <div class="swiper-slide">
                            <img src="${img}" alt="${article.subject}" onerror="this.src='https://placehold.co/800x400/fecaca/991b1b?text=Image+Not+Available'">
                        </div>`).join('');

                    if (modalSwiper) modalSwiper.destroy(true, true);
                    
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
                    
                    const otherArticles = articles.filter(a => a.article_id !== articleId).slice(0, 3);
                    const relatedHTML = otherArticles.length > 0 ? otherArticles.map(a => `
                        <div class="related-card" onclick="seotizeBlog.openArticle('${a.article_id}')">
                            <img src="${a.images?.[0] || 'https://placehold.co/300x150/e2e8f0/64748b?text=Related'}" alt="${a.subject}">
                            <div class="related-card-content">
                                <h4 class="related-card-title">${a.subject}</h4>
                                <p class="related-card-date">${formatDate(a.creation_time)}</p>
                            </div>
                        </div>`).join('') : '<p class="text-sm text-gray-500">No related articles found.</p>';
                    
                    document.getElementById('relatedArticles').innerHTML = relatedHTML;
                    document.getElementById('relatedArticlesMobile').innerHTML = relatedHTML;
                    
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
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('id');
            window.history.pushState({}, '', newUrl);
        }
    };
    
    // === 6. INITIALIZATION ===
    
    window.addEventListener('popstate', (event) => {
        const params = new URLSearchParams(window.location.search);
        const articleId = params.get('id');
        const modal = document.getElementById('articleModal');
        if (!modal) return;
        
        const isModalOpen = !modal.classList.contains('hidden');

        if (articleId && !isModalOpen) {
            seotizeBlog.openArticle(articleId);
        } else if (!articleId && isModalOpen) {
            seotizeBlog.closeModal();
        }
    });

    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('articleModal');
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            seotizeBlog.closeModal();
        }
    });

    document.addEventListener('DOMContentLoaded', function() {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        
        loadArticles().then(() => {
            if (articleId) {
                // We don't need to check if it's in the list, just open it.
                // The API will fetch it regardless of which page it's on.
                seotizeBlog.openArticle(articleId);
            }
        });
    });

})(); // End of IIFE
