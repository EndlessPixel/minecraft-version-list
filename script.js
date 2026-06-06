// ==============================================
// Minecraft 版本列表管理器 - 优化版
// ==============================================

// ----- 全局变量（仅保留必要状态）-----
let minecraftVersions = [];
let currentFilters = [];
let currentSearch = '';
let currentPage = 1;
let pageSize = 50;
let filteredVersions = [];

// ----- 常量配置 -----
const TYPE_MAP = {
    'release': '正式版',
    'old_alpha': '远古版',
    'old_beta': 'Beta',
    'snapshot': '快照版',
    'pending': '预发布版',
    'candidate': '发布候选版',
    'experiment': '实验性快照版',
    'April Fools': '愚人节版'
};

const TAG_GROUPS = {
    main: ['正式版', '发布候选版', '预发布版', '快照版', '实验性快照版', '愚人节版'],
    ancient: ['远古版', 'Beta', 'Alpha', 'Indev', 'Classic', 'pre-Classic']
};

// ----- DOM 元素 -----
const versionsContainer = document.getElementById('versions-container');
const tagsContainer = document.getElementById('tags-container');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

// ----- 辅助函数 -----
const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const parseManifest = (manifest) => {
    return manifest.versions.map(v => ({
        name: v.id,
        date: formatDate(v.releaseTime),
        type: v.type,
        tags: [TYPE_MAP[v.type] || v.type]
    }));
};

// ----- URL 参数管理 -----
const loadUrlParams = () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const tagsParam = params.get('tags');
        if (tagsParam) currentFilters = tagsParam.split(',');
        
        const searchParam = params.get('search');
        if (searchParam) {
            currentSearch = searchParam;
            if (searchInput) searchInput.value = searchParam;
        }
        
        const pageParam = params.get('page');
        if (pageParam && !isNaN(parseInt(pageParam))) currentPage = parseInt(pageParam);
        
        const sizeParam = params.get('size');
        if (sizeParam && !isNaN(parseInt(sizeParam))) pageSize = parseInt(sizeParam);
    } catch (e) { console.warn('URL 参数解析失败', e); }
};

const updateUrlParams = () => {
    try {
        const params = new URLSearchParams();
        if (currentFilters.length) params.set('tags', currentFilters.join(','));
        if (currentSearch) params.set('search', currentSearch);
        params.set('page', currentPage);
        params.set('size', pageSize);
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    } catch (e) { console.warn('URL 更新失败', e); }
};

// ----- 数据过滤与分页 -----
const filterVersions = (resetPage = true) => {
    const searchLower = currentSearch.toLowerCase().trim();
    filteredVersions = minecraftVersions.filter(version => {
        const matchTags = currentFilters.length === 0 || 
                         (version.tags && currentFilters.every(t => version.tags.includes(t)));
        const matchSearch = !searchLower || 
                           version.name.toLowerCase().includes(searchLower) ||
                           version.type.toLowerCase().includes(searchLower);
        return matchTags && matchSearch;
    });
    if (resetPage) currentPage = 1;
};

// ----- 渲染核心 (优化DOM操作)-----
const createVersionRow = (version) => {
    const row = document.createElement('tr');
    const wikiUrl = `https://zh.minecraft.wiki/w/Java版${encodeURIComponent(version.name)}`;
    const tagsHtml = (version.tags || [])
        .map(tag => `<span class="version-tag">${tag}</span>`)
        .join('');
    
    row.innerHTML = `
        <td><strong>${escapeHtml(version.name)}</strong></td>
        <td>${version.date || '-'}</td>
        <td>${tagsHtml}</td>
        <td><a href="${wikiUrl}" target="_blank" class="download-btn">Wiki</a></td>
    `;
    return row;
};

// 防止XSS的简单转义
const escapeHtml = (str) => {
    if (!str) return '';
    return str.replace(/[&<>]/g, (m) => {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
};

const renderVersions = () => {
    if (!versionsContainer) return;
    const tbody = versionsContainer.querySelector('tbody');
    if (!tbody) return;
    
    // 清空容器，使用 DocumentFragment 减少回流
    const fragment = document.createDocumentFragment();
    
    if (filteredVersions.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="4">暂无数据</td>';
        fragment.appendChild(emptyRow);
    } else {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageVersions = filteredVersions.slice(start, end);
        
        pageVersions.forEach(version => {
            fragment.appendChild(createVersionRow(version));
        });
    }
    
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    updatePaginationUI();
};

// ----- 标签管理（优化互斥逻辑）-----
const getAllTags = () => {
    const tagSet = new Set();
    minecraftVersions.forEach(v => {
        if (v.tags) v.tags.forEach(t => tagSet.add(t));
    });
    return Array.from(tagSet);
};

const getTagGroup = (tag) => {
    if (TAG_GROUPS.main.includes(tag)) return 'main';
    if (TAG_GROUPS.ancient.includes(tag)) return 'ancient';
    return null;
};

const toggleTag = (clickedTag) => {
    const group = getTagGroup(clickedTag);
    const isActive = currentFilters.includes(clickedTag);
    
    if (isActive) {
        // 移除标签
        currentFilters = currentFilters.filter(t => t !== clickedTag);
    } else {
        if (group) {
            // 互斥：清除同组所有标签，保留其他组的标签
            currentFilters = currentFilters.filter(t => getTagGroup(t) !== group);
        }
        currentFilters.push(clickedTag);
    }
    
    updateAndRender();
};

const renderTags = () => {
    if (!tagsContainer) return;
    tagsContainer.innerHTML = '';
    const allTags = getAllTags();
    
    allTags.forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = `tag ${currentFilters.includes(tag) ? 'active' : ''}`;
        tagEl.textContent = tag;
        tagEl.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTag(tag);
        });
        tagsContainer.appendChild(tagEl);
    });
};

// ----- 分页UI控制（统一委托事件，消除冲突）-----
const updatePaginationUI = () => {
    const totalItems = filteredVersions.length;
    const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
    
    // 更新页码信息
    document.querySelectorAll('.page-info').forEach(info => {
        info.textContent = totalItems === 0 ? '无数据' : `第 ${currentPage} 页，共 ${totalPages} 页`;
    });
    
    // 更新按钮禁用状态
    const prevBtns = document.querySelectorAll('.prev-page');
    const nextBtns = document.querySelectorAll('.next-page');
    const isPrevDisabled = currentPage <= 1 || totalItems === 0;
    const isNextDisabled = currentPage >= totalPages || totalItems === 0;
    
    prevBtns.forEach(btn => btn.disabled = isPrevDisabled);
    nextBtns.forEach(btn => btn.disabled = isNextDisabled);
    
    // 同步下拉框的值
    document.querySelectorAll('select[id^="page-size"]').forEach(select => {
        if (select.value != pageSize) select.value = pageSize;
    });
};

// 分页事件委托（统一处理，避免重复绑定）
const initPaginationEvents = () => {
    // 使用事件委托监听所有分页相关点击
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('.prev-page, .next-page');
        if (!target) return;
        
        e.preventDefault();
        const totalPages = Math.ceil(filteredVersions.length / pageSize);
        
        if (target.classList.contains('prev-page') && currentPage > 1) {
            currentPage--;
            updateUrlParams();
            renderVersions();
        } else if (target.classList.contains('next-page') && currentPage < totalPages) {
            currentPage++;
            updateUrlParams();
            renderVersions();
        }
    });
    
    // 监听每页显示数量变更
    document.body.addEventListener('change', (e) => {
        const select = e.target.closest('select[id^="page-size"]');
        if (!select) return;
        
        const newSize = parseInt(select.value);
        if (!isNaN(newSize) && newSize !== pageSize) {
            pageSize = newSize;
            currentPage = 1;
            updateUrlParams();
            renderVersions();
        }
    });
};

// ----- 搜索交互优化 -----
const performSearch = () => {
    currentSearch = searchInput?.value.trim() || '';
    updateUrlParams();
    filterVersions(true);
    renderVersions();
};

const initSearchEvents = () => {
    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }
};

// ----- 统一渲染流程 -----
const updateAndRender = () => {
    updateUrlParams();
    renderTags();
    filterVersions(true);
    renderVersions();
};

// ----- 数据加载与初始化 -----
const init = async () => {
    try {
        const response = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const manifest = await response.json();
        minecraftVersions = parseManifest(manifest);
        
        loadUrlParams();
        filterVersions(false);  // 首次加载不重置页码（保留URL中的page）
        renderTags();
        renderVersions();
        initPaginationEvents();
        initSearchEvents();
    } catch (error) {
        console.error('版本数据加载失败:', error);
        const tbody = versionsContainer?.querySelector('tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4">加载失败，请检查网络连接后刷新页面</td></tr>';
        }
    }
};

// 启动应用
init();