const sidebar = document.querySelector('#role-sidebar');
const menuToggle = document.querySelector('.role-menu-toggle');
const backdrop = document.querySelector('.role-sidebar-backdrop');
const currentUserKey = 'tms.currentUser';

const rolePages = {
  customer: [
    ['Overview', 'customer-dashboard.html'],
    ['Bookings', 'bookings.html'],
    ['Trips', 'trips.html'],
    ['Announcements', 'announcements.html'],
    ['Notifications', 'notifications.html'],
  ],
  driver: [
    ['Overview', 'driver-dashboard.html'],
    ['Trips', 'trips.html'],
    ['Incidents', 'incidents.html'],
    ['Announcements', 'announcements.html'],
    ['Notifications', 'notifications.html'],
  ],
  admin: [
    ['Overview', 'admin-dashboard.html'],
    ['User management', 'user-management.html'],
    ['Vehicles', 'vehicles.html'],
    ['Drivers', 'drivers.html'],
    ['Incidents', 'incidents.html'],
    ['Trips', 'trips.html'],
    ['Bookings', 'bookings.html'],
    ['Fuel', 'fuel.html'],
    ['Billing', 'billing.html', [
      ['Invoices', 'billing.html?tab=invoices', 'invoices'],
      ['Payments', 'billing.html?tab=payments', 'payments'],
    ]],
    ['Announcements', 'announcements.html'],
    ['Notifications', 'notifications.html'],
    ['Reports', 'reports.html', [
      ['All Categories', 'reports.html?category=all', 'all'],
      ['Fleet', 'reports.html?category=fleet', 'fleet'],
      ['Trips', 'reports.html?category=trips', 'trips'],
      ['Bookings', 'reports.html?category=bookings', 'bookings'],
      ['Invoices', 'reports.html?category=invoices', 'invoices'],
      ['Payments', 'reports.html?category=payments', 'payments'],
      ['Revenue', 'reports.html?category=revenue', 'revenue'],
    ]],
    ['Audit logs', 'audit-logs.html'],
  ],
};

const roleLabels = {
  customer: 'Customer',
  driver: 'Driver',
  admin: 'Administrator',
};

const NAV_ICONS = {
  overview: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  'user management': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  vehicles: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  drivers: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.93" y1="19.07" x2="9.88" y2="14.12"/><line x1="19.07" y1="19.07" x2="14.12" y2="14.12"/></svg>',
  incidents: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  trips: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H12"/></svg>',
  bookings: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>',
  fuel: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 22h12"/><path d="M4 9h10"/><path d="M4 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L19 6"/></svg>',
  billing: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
  announcements: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
  notifications: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  reports: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  'audit logs': '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  profile: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  logout: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

const CHEVRON_ICON = '<svg class="role-nav-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getNavIcon(label) {
  const key = (label || '').trim().toLowerCase();
  return NAV_ICONS[key] || '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/></svg>';
}

let currentUser;
try {
  currentUser = JSON.parse(sessionStorage.getItem(currentUserKey));
} catch (error) {
  console.error('Could not read the signed-in user:', error);
}

const links = rolePages[currentUser?.role];
if (!currentUser?.id || !links) {
  window.location.replace('login.html');
} else if (sidebar) {
  const currentPage = window.location.pathname.split('/').pop().split('?')[0];
  const currentSearch = new URLSearchParams(window.location.search);
  const activeCategory = currentSearch.get('category') || currentSearch.get('tab') || (currentPage === 'billing.html' ? 'invoices' : 'all');
  const isProfilePage = currentPage === 'profile.html';
  const currentPageAllowed = isProfilePage || links.some(([label, href]) => href.split('?')[0] === currentPage);

  if (!currentPageAllowed) {
    window.location.replace(links[0][1]);
  } else {
    const roleLabel = sidebar.querySelector('[data-profile-role], .role-nav-label');
    if (roleLabel) roleLabel.textContent = roleLabels[currentUser.role];

    const homeLink = sidebar.querySelector('.brand');
    if (homeLink) {
      homeLink.href = links[0][1];
      homeLink.innerHTML = `
        <span class="brand-badge">TMS</span>
        <span class="brand-title">
          <span class="brand-title-main">Transport System</span>
          <span class="brand-title-sub">Fleet &amp; Logistics</span>
        </span>
      `;
    }

    const navigation = sidebar.querySelector('[data-role-pages]');
    if (navigation) {
      navigation.replaceChildren(...links.map(([label, href, children]) => {
        if (!children) {
          const link = document.createElement('a');
          link.href = href;
          link.innerHTML = `${getNavIcon(label)}<span class="nav-label-text">${escapeHtml(label)}</span>`;
          if (currentPage === href) link.setAttribute('aria-current', 'page');
          return link;
        }

        const isCurrentParent = currentPage === href.split('?')[0];
        const group = document.createElement('div');
        group.className = 'role-nav-group';

        const parentRow = document.createElement('div');
        parentRow.className = 'role-nav-parent-row';

        const parentLink = document.createElement('a');
        parentLink.href = href;
        parentLink.innerHTML = `${getNavIcon(label)}<span class="nav-label-text">${escapeHtml(label)}</span>`;
        if (isCurrentParent) parentLink.setAttribute('aria-current', 'page');

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'role-nav-subtoggle';
        toggleBtn.setAttribute('aria-label', `Toggle ${label} sub-navigation`);
        toggleBtn.innerHTML = CHEVRON_ICON;

        parentRow.append(parentLink, toggleBtn);

        const subnav = document.createElement('div');
        subnav.className = 'role-subnav';
        subnav.id = `role-subnav-${label.toLowerCase().replace(/\s+/g, '-')}`;

        let isOpen = isCurrentParent;
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        subnav.hidden = !isOpen;

        toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          isOpen = !isOpen;
          toggleBtn.setAttribute('aria-expanded', String(isOpen));
          subnav.hidden = !isOpen;
        });

        parentLink.addEventListener('click', (e) => {
          if (isCurrentParent) {
            if (subnav.hidden) {
              isOpen = true;
              toggleBtn.setAttribute('aria-expanded', 'true');
              subnav.hidden = false;
            }
            if (href.includes('reports.html') && typeof window.switchReportCategory === 'function') {
              e.preventDefault();
              window.switchReportCategory('all');
            } else if (href.includes('billing.html') && typeof window.switchBillingTab === 'function') {
              e.preventDefault();
              window.switchBillingTab('invoices');
            }
          }
        });

        for (const [childLabel, childHref, childCat] of children) {
          const childLink = document.createElement('a');
          childLink.href = childHref;
          childLink.className = 'role-subnav-link';
          childLink.dataset.category = childCat;

          const dot = document.createElement('span');
          dot.className = 'role-subnav-dot';

          const labelSpan = document.createElement('span');
          labelSpan.textContent = childLabel;

          childLink.append(dot, labelSpan);

          if (isCurrentParent && activeCategory === childCat) {
            childLink.setAttribute('aria-current', 'page');
            childLink.classList.add('active');
          }

          childLink.addEventListener('click', (e) => {
            if (isCurrentParent) {
              if (href.includes('reports.html') && typeof window.switchReportCategory === 'function') {
                e.preventDefault();
                window.switchReportCategory(childCat);
              } else if (href.includes('billing.html') && typeof window.switchBillingTab === 'function') {
                e.preventDefault();
                window.switchBillingTab(childCat);
              }
            }
            if (window.innerWidth <= 620 && typeof setMenuOpen === 'function') {
              setMenuOpen(false);
            }
          });

          subnav.append(childLink);
        }

        group.append(parentRow, subnav);
        return group;
      }));
    }

    const profileLink = sidebar.querySelector('.role-profile-link');
    if (profileLink) {
      profileLink.innerHTML = `${getNavIcon('profile')}<span class="nav-label-text">Profile</span>`;
      if (isProfilePage) profileLink.setAttribute('aria-current', 'page');
    }
  }
}

window.updateSidebarActiveCategory = function (category) {
  if (!sidebar) return;
  const reportsSubnav = sidebar.querySelector('#role-subnav-reports');
  if (!reportsSubnav) return;
  const subnavLinks = reportsSubnav.querySelectorAll('.role-subnav-link');
  subnavLinks.forEach((link) => {
    const isMatch = link.dataset.category === category;
    link.classList.toggle('active', isMatch);
    if (isMatch) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  const reportsToggle = reportsSubnav.previousElementSibling?.querySelector('.role-nav-subtoggle');
  if (reportsSubnav.hidden) {
    reportsSubnav.hidden = false;
    reportsToggle?.setAttribute('aria-expanded', 'true');
  }
};

window.updateSidebarActiveBillingTab = function (tab) {
  if (!sidebar) return;
  const billingSubnav = sidebar.querySelector('#role-subnav-billing');
  if (!billingSubnav) return;
  const subnavLinks = billingSubnav.querySelectorAll('.role-subnav-link');
  subnavLinks.forEach((link) => {
    const isMatch = link.dataset.category === tab;
    link.classList.toggle('active', isMatch);
    if (isMatch) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  const billingToggle = billingSubnav.previousElementSibling?.querySelector('.role-nav-subtoggle');
  if (billingSubnav.hidden) {
    billingSubnav.hidden = false;
    billingToggle?.setAttribute('aria-expanded', 'true');
  }
};

const logoutButton = sidebar?.querySelector('[data-logout]');
if (logoutButton) {
  logoutButton.innerHTML = `${getNavIcon('logout')}<span class="nav-label-text">Log out</span>`;
  logoutButton.addEventListener('click', () => {
    sessionStorage.removeItem(currentUserKey);
    window.location.replace('login.html');
  });
}

let setMenuOpen;
if (sidebar && menuToggle && backdrop) {
  const mobileViewport = window.matchMedia('(max-width: 620px)');

  setMenuOpen = function (isOpen) {
    const shouldOpen = mobileViewport.matches && isOpen;
    sidebar.dataset.open = String(shouldOpen);
    sidebar.inert = mobileViewport.matches && !shouldOpen;
    menuToggle.setAttribute('aria-expanded', String(shouldOpen));
    menuToggle.setAttribute('aria-label', shouldOpen ? 'Close navigation' : 'Open navigation');
    backdrop.hidden = !shouldOpen;
  };

  menuToggle.addEventListener('click', () => {
    setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
  });

  backdrop.addEventListener('click', () => setMenuOpen(false));

  sidebar.querySelectorAll('a, [data-logout]').forEach((link) => {
    link.addEventListener('click', () => setMenuOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  mobileViewport.addEventListener('change', () => setMenuOpen(false));
  setMenuOpen(false);
}
