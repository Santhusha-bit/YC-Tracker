// YC Startup Tracker - Real-time API Integration
// Data source: https://yc-oss.github.io/api/

const API_BASE = 'https://yc-oss.github.io/api';
const API_META = `${API_BASE}/meta.json`;
const API_ALL_COMPANIES = `${API_BASE}/companies/all.json`;

let allStartups = [];
let currentData = [];
let sortColumn = null;
let sortDirection = 'asc';
let currentPage = 1;
let itemsPerPage = 50;
let viewMode = 'table';
let metaData = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    initializeTheme();
    await loadData();
    attachEventListeners();
});

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    
    if (theme === 'dark') {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light';
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

// Logo Management - Get company initials for placeholder
function getCompanyInitials(name) {
    if (!name) return '??';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Get logo URL with fallbacks
function getLogoUrl(startup) {
    // Try different logo URL fields in order of preference
    const logoFields = [
        'small_logo_thumb_url',
        'logo_url',
        'large_logo_url',
        'small_logo_url',
        'thumbnail_url'
    ];
    
    for (const field of logoFields) {
        if (startup[field] && startup[field].trim() !== '') {
            return startup[field];
        }
    }
    
    return null;
}

// Get favicon URL from website
function getFaviconUrl(website) {
    if (!website) return null;
    try {
        const url = new URL(website);
        return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
    } catch (e) {
        return null;
    }
}

// Create logo HTML with error handling and fallbacks
function createLogoHtml(startup, className = 'card-logo', size = 48) {
    const logoUrl = getLogoUrl(startup);
    const faviconUrl = getFaviconUrl(startup.website);
    const initials = getCompanyInitials(startup.name);
    const name = startup.name || 'Unknown';
    const escapedName = name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const escapedInitials = initials.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    
    // Generate unique ID for this logo container
    const logoId = `logo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const placeholderClass = className === 'card-logo' ? 'card-logo-placeholder' : 'modal-logo-placeholder';
    const borderRadius = size === 64 ? '12px' : '8px';
    const fontSize = Math.max(size * 0.4, size === 64 ? 20 : 16);
    
    if (logoUrl) {
        // Try the API logo first, with favicon and initials as fallbacks
        // Use data attributes and setup error handler after DOM insertion
        const safeFavicon = (faviconUrl || '').replace(/'/g, "\\'");
        return `
            <div id="${logoId}" 
                 data-favicon="${safeFavicon}" 
                 data-initials="${escapedInitials}" 
                 data-size="${size}" 
                 data-class="${placeholderClass}" 
                 data-radius="${borderRadius}" 
                 data-font-size="${fontSize}" 
                 style="position: relative; width: ${size}px; height: ${size}px;">
                <img src="${logoUrl}" 
                     alt="${escapedName}" 
                     class="${className}" 
                     style="width: ${size}px; height: ${size}px; object-fit: cover; border-radius: ${borderRadius}; display: block;">
            </div>
        `;
    } else if (faviconUrl) {
        // Try favicon if no API logo
        return `
            <div id="${logoId}" 
                 data-initials="${escapedInitials}" 
                 data-size="${size}" 
                 data-class="${placeholderClass}" 
                 data-radius="${borderRadius}" 
                 data-font-size="${fontSize}" 
                 style="position: relative; width: ${size}px; height: ${size}px;">
                <img src="${faviconUrl}" 
                     alt="${escapedName}" 
                     class="${className}" 
                     style="width: ${size}px; height: ${size}px; object-fit: cover; border-radius: ${borderRadius}; display: block;">
            </div>
        `;
    } else {
        // Fallback to initials placeholder
        return `
            <div class="${placeholderClass}" style="width: ${size}px; height: ${size}px; background: var(--primary-accent); color: white; border-radius: ${borderRadius}; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: ${fontSize}px; flex-shrink: 0;">
                ${escapedInitials}
            </div>
        `;
    }
}

// Setup logo error handlers after rendering
function setupLogoErrorHandlers() {
    // Find all logo containers and attach error handlers
    document.querySelectorAll('[id^="logo-"]').forEach(container => {
        const img = container.querySelector('img');
        if (!img) return;
        
        // Skip if already has error handler or if image already loaded successfully
        if (img.hasAttribute('data-error-handler-set')) return;
        if (img.complete && img.naturalHeight !== 0) return; // Image loaded successfully
        
        img.setAttribute('data-error-handler-set', 'true');
        
        const faviconUrl = container.getAttribute('data-favicon') || '';
        const initials = container.getAttribute('data-initials');
        const size = parseInt(container.getAttribute('data-size')) || 48;
        const placeholderClass = container.getAttribute('data-class') || 'card-logo-placeholder';
        const borderRadius = container.getAttribute('data-radius') || '8px';
        const fontSize = parseInt(container.getAttribute('data-font-size')) || 16;
        
        img.onerror = function() {
            this.onerror = null; // Prevent infinite loop
            if (faviconUrl && faviconUrl.trim() !== '') {
                // Try favicon fallback
                this.src = faviconUrl;
                this.onerror = function() {
                    // If favicon also fails, show initials
                    this.onerror = null;
                    showInitialsPlaceholder(container, initials, size, placeholderClass, borderRadius, fontSize);
                };
            } else {
                // Show initials directly
                showInitialsPlaceholder(container, initials, size, placeholderClass, borderRadius, fontSize);
            }
        };
    });
}

// Show initials placeholder
function showInitialsPlaceholder(container, initials, size, placeholderClass, borderRadius, fontSize) {
    container.innerHTML = `<div class="${placeholderClass}" style="width: ${size}px; height: ${size}px; background: var(--primary-accent); color: white; border-radius: ${borderRadius}; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: ${fontSize}px; flex-shrink: 0;">${initials}</div>`;
}

// Load data from API
async function loadData() {
    try {
        showLoading(true);
        
        // Fetch metadata
        const metaResponse = await fetch(API_META);
        metaData = await metaResponse.json();
        
        // Fetch all companies
        const companiesResponse = await fetch(API_ALL_COMPANIES);
        allStartups = await companiesResponse.json();
        currentData = [...allStartups];
        
        // Update stats
        updateStats();
        
        // Populate filters
        populateFilters();
        
        // Render initial view
        renderCurrentView();
        
        showLoading(false);
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load startup data. Please refresh the page.');
    }
}

// Update statistics
function updateStats() {
    document.getElementById('total-startups').textContent = allStartups.length.toLocaleString();
    
    if (metaData) {
        const batchCount = metaData.batches ? Object.keys(metaData.batches).length : null;
        const industryCount = metaData.industries ? Object.keys(metaData.industries).length : null;

        document.getElementById('total-batches').textContent = batchCount ? batchCount.toLocaleString() : '-';
        document.getElementById('total-industries').textContent = industryCount ? industryCount.toLocaleString() : '-';
        
        const lastUpdated = new Date(metaData.last_updated);
        const formattedDate = lastUpdated.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        document.getElementById('last-updated').textContent = formattedDate;
    }
}

// Populate filter dropdowns
function populateFilters() {
    // Batches
    const batches = [...new Set(allStartups.map(s => s.batch).filter(Boolean))].sort().reverse();
    const batchFilter = document.getElementById('batch-filter');
    batches.forEach(batch => {
        const option = document.createElement('option');
        option.value = batch;
        option.textContent = batch;
        batchFilter.appendChild(option);
    });
    
    // Industries
    const industries = [...new Set(allStartups.flatMap(s => s.industries || []))].sort();
    const industryFilter = document.getElementById('industry-filter');
    industries.slice(0, 50).forEach(industry => { // Limit to 50 for performance
        const option = document.createElement('option');
        option.value = industry;
        option.textContent = industry;
        industryFilter.appendChild(option);
    });
    
    // Locations
    const locations = [...new Set(allStartups.map(s => {
        if (!s.all_locations) return null;
        // Extract country/region from location string
        const parts = s.all_locations.split(',');
        return parts[parts.length - 1].trim();
    }).filter(Boolean))].sort();
    
    const locationFilter = document.getElementById('location-filter');
    locations.slice(0, 100).forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

// Apply filters
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const batchFilter = document.getElementById('batch-filter').value;
    const industryFilter = document.getElementById('industry-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const locationFilter = document.getElementById('location-filter').value;
    
    currentData = allStartups.filter(startup => {
        // Search filter
        const matchesSearch = searchTerm === '' || 
            startup.name.toLowerCase().includes(searchTerm) ||
            (startup.long_description && startup.long_description.toLowerCase().includes(searchTerm)) ||
            (startup.one_liner && startup.one_liner.toLowerCase().includes(searchTerm));
        
        // Batch filter
        const matchesBatch = batchFilter === 'all' || startup.batch === batchFilter;
        
        // Industry filter
        const matchesIndustry = industryFilter === 'all' || 
            (startup.industries && startup.industries.includes(industryFilter));
        
        // Status filter
        const matchesStatus = statusFilter === 'all' || startup.status === statusFilter;
        
        // Location filter
        const matchesLocation = locationFilter === 'all' || 
            (startup.all_locations && startup.all_locations.includes(locationFilter));
        
        return matchesSearch && matchesBatch && matchesIndustry && matchesStatus && matchesLocation;
    });
    
    currentPage = 1;
    renderCurrentView();
}

// Reset filters
function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('batch-filter').value = 'all';
    document.getElementById('industry-filter').value = 'all';
    document.getElementById('status-filter').value = 'all';
    document.getElementById('location-filter').value = 'all';
    
    currentData = [...allStartups];
    currentPage = 1;
    renderCurrentView();
}

// Render current view (table or grid)
function renderCurrentView() {
    if (viewMode === 'table') {
        renderTable();
    } else {
        renderGrid();
    }
    updateResultsInfo();
    updatePagination();
}

// Render table view
function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = currentData.slice(start, end);
    
    if (pageData.length === 0) {
        document.getElementById('no-results').style.display = 'block';
        return;
    }
    
    document.getElementById('no-results').style.display = 'none';
    
    pageData.forEach((startup, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${startup.name}</strong></td>
            <td><span class="cohort-badge">${startup.batch || 'N/A'}</span></td>
            <td>${startup.industries ? startup.industries.slice(0, 2).join(', ') : 'N/A'}</td>
            <td>${startup.all_locations || 'N/A'}</td>
            <td><span class="status-badge status-${(startup.status || 'active').toLowerCase()}">${startup.status || 'Active'}</span></td>
            <td>${startup.team_size || '-'}</td>
            <td><button class="view-details-btn" onclick="showDetails(${start + index})">View</button></td>
        `;
        tbody.appendChild(row);
    });
    
    // Setup error handlers for logos after rendering (though table doesn't show logos currently)
    // setTimeout(setupLogoErrorHandlers, 100);
}

// Render grid view
function renderGrid() {
    const grid = document.getElementById('grid-view');
    grid.innerHTML = '';
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = currentData.slice(start, end);
    
    if (pageData.length === 0) {
        document.getElementById('no-results').style.display = 'block';
        return;
    }
    
    document.getElementById('no-results').style.display = 'none';
    
    pageData.forEach((startup, index) => {
        const card = document.createElement('div');
        card.className = 'startup-card';
        card.onclick = () => showDetails(start + index);
        
        card.innerHTML = `
            <div class="card-header">
                ${createLogoHtml(startup, 'card-logo', 48)}
                <div class="card-title">
                    <h3>${startup.name}</h3>
                    <div class="card-batch">${startup.batch || 'Unknown Batch'}</div>
                </div>
            </div>
            <div class="card-description">
                ${startup.one_liner || startup.long_description || 'No description available'}
            </div>
            <div class="card-footer">
                <div class="card-tags">
                    ${startup.industries ? startup.industries.slice(0, 2).map(ind => 
                        `<span class="card-tag">${ind}</span>`
                    ).join('') : ''}
                </div>
                <span class="status-badge status-${(startup.status || 'active').toLowerCase()}">${startup.status || 'Active'}</span>
            </div>
        `;
        
        grid.appendChild(card);
    });
    
    // Setup error handlers for logos after rendering
    setTimeout(setupLogoErrorHandlers, 100);
}

// Update results info
function updateResultsInfo() {
    const total = currentData.length;
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(start + itemsPerPage - 1, total);
    
    document.getElementById('results-count').textContent = 
        `Showing ${start}-${end} of ${total.toLocaleString()} startups`;
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
    
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages || totalPages === 0;
}

// Show startup details
function showDetails(index) {
    const startup = currentData[index];
    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    
    const founders = startup.founders ? 
        `<ul class="founder-list">
            ${startup.founders.map(f => `<li>${f.name || 'Unknown'}</li>`).join('')}
        </ul>` : 
        '<p>Founder information not available</p>';
    
    modalBody.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
            ${createLogoHtml(startup, 'modal-logo', 64)}
            <div>
                <h2 style="margin: 0 0 8px 0;">${startup.name}</h2>
                <p style="margin: 0; color: var(--primary-accent); font-weight: 600;">${startup.batch || 'Unknown Batch'}</p>
            </div>
        </div>
        
        <div class="modal-section">
            <h3>About</h3>
            <p>${startup.one_liner || startup.long_description || 'No description available'}</p>
        </div>
        
        <div class="modal-section">
            <h3>Details</h3>
            <p><strong>Status:</strong> <span class="status-badge status-${(startup.status || 'active').toLowerCase()}">${startup.status || 'Active'}</span></p>
            <p><strong>Location:</strong> ${startup.all_locations || 'N/A'}</p>
            <p><strong>Team Size:</strong> ${startup.team_size || 'N/A'}</p>
            ${startup.industries ? `<p><strong>Industries:</strong> ${startup.industries.join(', ')}</p>` : ''}
        </div>
        
        <div class="modal-section">
            <h3>Founders</h3>
            ${founders}
        </div>
        
        ${startup.website ? `
            <div class="modal-section">
                <h3>Links</h3>
                <p><a href="${startup.website}" target="_blank" rel="noopener">${startup.website}</a></p>
            </div>
        ` : ''}
    `;
    
    modal.style.display = 'block';
    
    // Setup error handlers for modal logo after rendering
    setTimeout(setupLogoErrorHandlers, 100);
}

// Sort table
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    currentData.sort((a, b) => {
        let aVal, bVal;
        
        switch(column) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'batch':
                aVal = a.batch || '';
                bVal = b.batch || '';
                break;
            case 'status':
                aVal = a.status || '';
                bVal = b.status || '';
                break;
            default:
                return 0;
        }
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    renderCurrentView();
}

// Export to CSV
function exportToCSV() {
    const headers = ['Company', 'Batch', 'Status', 'Location', 'Industries', 'Team Size', 'Website', 'Description'];
    const rows = currentData.map(s => [
        s.name,
        s.batch || '',
        s.status || '',
        s.all_locations || '',
        s.industries ? s.industries.join('; ') : '',
        s.team_size || '',
        s.website || '',
        `"${(s.one_liner || s.long_description || '').replace(/"/g, '""')}"`
    ]);
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yc-startups-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Switch view mode
function switchViewMode(mode) {
    viewMode = mode;
    
    if (mode === 'table') {
        document.getElementById('table-view').style.display = 'block';
        document.getElementById('grid-view').style.display = 'none';
        document.getElementById('view-mode-table').classList.add('active');
        document.getElementById('view-mode-grid').classList.remove('active');
    } else {
        document.getElementById('table-view').style.display = 'none';
        document.getElementById('grid-view').style.display = 'grid';
        document.getElementById('view-mode-table').classList.remove('active');
        document.getElementById('view-mode-grid').classList.add('active');
    }
    
    renderCurrentView();
}

// Show/hide loading
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('table-view').style.display = show ? 'none' : 'block';
    document.getElementById('pagination').style.display = show ? 'none' : 'flex';
}

// Show error
function showError(message) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `<p style="color: #f44336;">${message}</p>`;
}

// Close modal
function closeModal() {
    document.getElementById('detail-modal').style.display = 'none';
}

// Attach event listeners
function attachEventListeners() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('search-btn').addEventListener('click', applyFilters);
    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') applyFilters();
    });
    
    document.getElementById('batch-filter').addEventListener('change', applyFilters);
    document.getElementById('industry-filter').addEventListener('change', applyFilters);
    document.getElementById('status-filter').addEventListener('change', applyFilters);
    document.getElementById('location-filter').addEventListener('change', applyFilters);
    
    document.getElementById('reset-filters').addEventListener('click', resetFilters);
    document.getElementById('refresh-data').addEventListener('click', loadData);
    document.getElementById('export-btn').addEventListener('click', exportToCSV);
    
    document.getElementById('view-mode-table').addEventListener('click', () => switchViewMode('table'));
    document.getElementById('view-mode-grid').addEventListener('click', () => switchViewMode('grid'));
    
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        const totalPages = Math.ceil(currentData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detail-modal');
        if (e.target === modal) closeModal();
    });
}

// Make functions available globally
window.showDetails = showDetails;
window.sortTable = sortTable;
window.resetFilters = resetFilters;