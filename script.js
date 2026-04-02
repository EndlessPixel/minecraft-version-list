// ==============================================
// 全局强制捕获 下一页 按钮
// ==============================================
document.addEventListener('click', function(e) {
  if (e.target && e.target.classList.contains('next-page')) {
    e.preventDefault();
    e.stopPropagation();

    const totalPages = Math.ceil(filteredVersions.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      updateUrlParams();
      renderVersions();
    }
  }
}, true);

// 全局变量
let minecraftVersions = [];
let currentFilters = [];
let currentSearch = '';

// 分页相关变量
let currentPage = 1;
let pageSize = 50;
let filteredVersions = [];

// 标签分组配置
const TAG_GROUPS = {
  main: ['正式版', '发布候选版', '预发布版', '快照版', '实验性快照版', '愚人节版'],
  ancient: ['远古版', 'Beta', 'Alpha', 'Indev', 'Classic', 'pre-Classic']
};

// DOM元素
const versionsContainer = document.getElementById('versions-container');
const tagsContainer = document.getElementById('tags-container');
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');

// 分页组件类
class Pagination {
    constructor() {
        this.pageSizeSelects = document.querySelectorAll('select[id^="page-size"]');
        this.prevPageBtns = document.querySelectorAll('.prev-page');
        this.nextPageBtns = document.querySelectorAll('.next-page');
        this.pageInfos = document.querySelectorAll('.page-info');
        this.bindEvents();
    }
    
    bindEvents() {
        this.pageSizeSelects.forEach(sel => sel.replaceWith(sel.cloneNode(true)));
        this.prevPageBtns.forEach(btn => btn.replaceWith(btn.cloneNode(true)));
        this.nextPageBtns.forEach(btn => btn.replaceWith(btn.cloneNode(true)));

        this.pageSizeSelects = document.querySelectorAll('select[id^="page-size"]');
        this.prevPageBtns = document.querySelectorAll('.prev-page');
        this.nextPageBtns = document.querySelectorAll('.next-page');

        this.nextPageBtns.forEach((btn) => {
            btn.onclick = () => {
                const totalPages = Math.ceil(filteredVersions.length / pageSize);
                if (currentPage < totalPages) {
                    currentPage++;
                    updateUrlParams();
                    renderVersions();
                }
            };
        });

        this.prevPageBtns.forEach(btn => {
            btn.onclick = () => {
                if (currentPage > 1) {
                    currentPage--;
                    updateUrlParams();
                    renderVersions();
                }
            };
        });

        this.pageSizeSelects.forEach(select => {
            select.addEventListener('change', (e) => {
                pageSize = parseInt(e.target.value) || 50;
                currentPage = 1;
                updateUrlParams();
                renderVersions();
            });
        });
    }
    
    update() {
        const totalItems = filteredVersions.length;
        const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
        
        this.pageInfos.forEach(info => {
            info.textContent = totalItems === 0 ? '无数据' : `第 ${currentPage} 页，共 ${totalPages} 页`;
        });
        
        this.prevPageBtns.forEach(btn => btn.disabled = currentPage <= 1 || totalItems === 0);
        this.nextPageBtns.forEach(btn => btn.disabled = currentPage >= totalPages);
        this.pageSizeSelects.forEach(select => select.value = pageSize);
    }
}

let pagination;

// 初始化
async function init() {
    try {
        const response = await fetch('versions.json');
        minecraftVersions = await response.json();
        
        loadUrlParams();
        filterVersions(false);
        renderTags();
        bindEvents();
        pagination = new Pagination();
        renderVersions();
    } catch (error) {
        console.error('加载版本数据失败:', error);
        const tbody = versionsContainer?.querySelector('tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
    }
}

// 加载URL参数
function loadUrlParams() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const tagsParam = urlParams.get('tags');
        if (tagsParam) currentFilters = tagsParam.split(',');
        
        const searchParam = urlParams.get('search');
        if (searchParam) {
            currentSearch = searchParam;
            searchInput.value = searchParam;
        }
        const pageParam = urlParams.get('page');
        if (pageParam && !isNaN(parseInt(pageParam))) currentPage = parseInt(pageParam);
        const sizeParam = urlParams.get('size');
        if (sizeParam && !isNaN(parseInt(sizeParam))) pageSize = parseInt(sizeParam);
    } catch (e) {}
}

// 更新URL参数
function updateUrlParams() {
    try {
        const urlParams = new URLSearchParams();
        if (currentFilters.length > 0) urlParams.set('tags', currentFilters.join(','));
        if (currentSearch) urlParams.set('search', currentSearch);
        urlParams.set('page', currentPage);
        urlParams.set('size', pageSize);
        window.history.replaceState({}, '', `${window.location.pathname}?${urlParams}`);
    } catch (e) {}
}

// 获取所有唯一标签
function getAllTags() {
    const tagsSet = new Set();
    minecraftVersions.forEach(v => {
        if (v.tags) v.tags.forEach(t => tagsSet.add(t));
    });
    return Array.from(tagsSet);
}

// 渲染标签
function renderTags() {
    if (!tagsContainer) return;
    tagsContainer.innerHTML = '';
    getAllTags().forEach(tag => {
        const el = document.createElement('div');
        el.className = `tag ${currentFilters.includes(tag) ? 'active' : ''}`;
        el.textContent = tag;
        el.addEventListener('click', () => toggleTag(tag));
        tagsContainer.appendChild(el);
    });
}

// 标签切换
function toggleTag(clickedTag) {
  const getGroup = (tag) => {
    if (TAG_GROUPS.main.includes(tag)) return 'main';
    if (TAG_GROUPS.ancient.includes(tag)) return 'ancient';
    return null;
  };
  const group = getGroup(clickedTag);
  const isActive = currentFilters.includes(clickedTag);

  if (isActive) {
    currentFilters = currentFilters.filter(t => t !== clickedTag);
  } else {
    if (group) currentFilters = currentFilters.filter(t => !TAG_GROUPS.main.includes(t) && !TAG_GROUPS.ancient.includes(t));
    currentFilters.push(clickedTag);
  }
  updateAndRender();
}

function updateAndRender() {
  updateUrlParams();
  renderTags();
  filterVersions(true);
  renderVersions();
}

// 过滤版本（彻底移除“跳过”）
function filterVersions(resetPage = true) {
    filteredVersions = minecraftVersions.filter(version => {
        if (version.name === "跳过") return false;
        
        const matchTags = currentFilters.length === 0 || (version.tags && currentFilters.every(t => version.tags.includes(t)));
        const kw = currentSearch.toLowerCase().trim();
        const matchSearch = !kw || (version.name || "").toLowerCase().includes(kw) || (version.description || "").toLowerCase().includes(kw);
        return matchTags && matchSearch;
    });
    if (resetPage) currentPage = 1;
    return filteredVersions;
}

// 渲染版本
function renderVersions() {
    if (!versionsContainer) return;
    const tbody = versionsContainer.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filteredVersions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">无数据</td></tr>';
        pagination?.update();
        return;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const list = filteredVersions.slice(start, end);
    list.forEach(v => tbody.appendChild(createVersionRow(v)));
    pagination?.update();
}

// 创建行（移除跳过逻辑）
function createVersionRow(version) {
    const row = document.createElement('tr');
    const desc = (version.description || '').length > 30 ? (version.description.substring(0,30)+"...") : (version.description || '');
    row.innerHTML = `
        <td><strong>${version.name}</strong></td>
        <td>${version.date || '-'}</td>
        <td><span>${desc}</span> <button class="description-btn">详情</button></td>
        <td>${(version.tags || []).map(t=>`<span class="version-tag">${t}</span>`).join('')}</td>
        <td><button class="download-btn">查看</button></td>
    `;
    row.querySelector('.download-btn').onclick = () => openDownloadModal(version);
    row.querySelector('.description-btn').onclick = () => openDescriptionModal(version);
    return row;
}

// 弹窗
const downloadModal = document.getElementById('download-modal');
const descriptionModal = document.getElementById('description-modal');

function openDownloadModal(v) { 
    document.getElementById('modal-body').innerHTML = v.downloads 
        ? Object.entries(v.downloads).map(([key, url]) => {
            // 自动把 key 翻译成中文名称
            const nameMap = {
                client: "客户端",
                server: "服务端",
                json: "JSON文件",
                wiki: "Wiki 页面",
                minecraft: "官方文章"
            };
            const name = nameMap[key] || key;
            return `<a href="${url}" target="_blank" class="download-link">${name}</a>`;
        }).join('') 
        : "无链接"; 
    downloadModal.classList.add('active'); 
}
function openDescriptionModal(v) { 
    document.getElementById('description-modal-body').textContent = v.description || "无描述"; 
    descriptionModal.classList.add('active'); 
}
function closeDownloadModal() { downloadModal.classList.remove('active'); }
function closeDescriptionModalFunc() { descriptionModal.classList.remove('active'); }

// 绑定事件
function bindEvents() {
    searchButton?.addEventListener('click', performSearch);
    searchInput?.addEventListener('keypress', e=>e.key==='Enter'&&performSearch());
    document.getElementById('close-modal')?.addEventListener('click', closeDownloadModal);
    document.getElementById('close-description-modal')?.addEventListener('click', closeDescriptionModalFunc);
}

function performSearch() {
    currentSearch = searchInput.value.trim();
    updateUrlParams();
    filterVersions(true);
    renderVersions();
}

// 启动
init();