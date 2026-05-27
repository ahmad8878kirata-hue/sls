const API_URL = '/api';

function setToken(token) {
    localStorage.setItem('token', token);
}

function getToken() {
    return localStorage.getItem('token');
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers,
    });

    if (response.status === 401 || response.status === 403) {
        logout();
    }

    return response;
}

function checkAuth() {
    const user = getUser();
    if (!user) {
        window.location.href = 'index.html';
    }
    return user;
}

function updateHeader() {
    const user = getUser();
    const header = document.querySelector('header');

    if (user && header) {
        if (!document.getElementById('nav-menu')) {
            const userInfoEl = document.getElementById('user-info');
            if (userInfoEl) userInfoEl.remove();

            const isAdmin = user.role === 'admin';
            let navHTML = '';

            if (isAdmin) {
                navHTML = `
                    <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleMenu()"></div>
                    <div class="nav-container" id="nav-container">
                        <nav id="nav-menu" class="nav-menu">
                            <a href="admin.html">لوحة الإدارة</a>
                        </nav>
                        <div class="user-actions">
                            <span class="username-display" style="font-weight: bold;">${user.username} (مدير)</span>
                            <button onclick="logout()" class="btn btn-danger logout-btn" style="padding: 6px 12px; font-size: 14px;">خروج</button>
                        </div>
                    </div>
                    <div class="burger-menu" onclick="toggleMenu()">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                `;
            } else {
                navHTML = `
                    <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleMenu()"></div>
                    <div class="nav-container" id="nav-container">
                        <nav id="nav-menu" class="nav-menu">
                            <a href="services.html">الخدمات</a>
                            <a href="topup.html">شحن الرصيد</a>
                            <a href="dashboard.html">طلباتي</a>
                        </nav>
                        <div class="user-actions">
                            <div class="balances">
                                <span class="balance" id="header-balance" title="دولار أمريكي">
                                    <span class="currency-icon">USD</span> ${(user.balance || 0).toFixed(2)}
                                </span>
                                <span class="balance syp-balance" id="header-balance-syp" title="ليرة سورية">
                                    <span class="currency-icon">SYP</span> ${(user.balance_syp || 0).toLocaleString()}
                                </span>
                            </div>
                            <span class="username-display" style="font-weight: bold;">${user.username}</span>
                            <button onclick="logout()" class="btn btn-danger logout-btn" style="padding: 6px 12px; font-size: 14px;">خروج</button>
                        </div>
                    </div>
                    <div class="burger-menu" onclick="toggleMenu()">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                `;
            }

            header.innerHTML = `
                <a href="${isAdmin ? 'admin.html' : 'services.html'}" class="logo">
                    <img src="img/logo.jpg" alt="SLS Logo" class="logo-img">
                    ${isAdmin ? '<span class="logo-text">SLS - الإدارة</span>' : ''}
                </a>
                ${navHTML}
            `;
        } else {
            const balEl = document.getElementById('header-balance');
            const balSypEl = document.getElementById('header-balance-syp');
            if (balEl && user.role !== 'admin') balEl.innerHTML = `<span class="currency-icon">USD</span> ${(user.balance || 0).toFixed(2)}`;
            if (balSypEl && user.role !== 'admin') balSypEl.innerHTML = `<span class="currency-icon">SYP</span> ${(user.balance_syp || 0).toLocaleString()}`;
        }
    }
}

function toggleMenu() {
    const navContainer = document.getElementById('nav-container');
    const overlay = document.getElementById('sidebar-overlay');
    if (navContainer) navContainer.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

async function refreshUserData() {
    try {
        const res = await fetchWithAuth('/user');
        if (res.ok) {
            const userData = await res.json();
            setUser(userData);
            updateHeader();
        }
    } catch (e) {
        console.error(e);
    }
}
