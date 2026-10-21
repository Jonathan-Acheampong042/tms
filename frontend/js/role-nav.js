const sidebar = document.querySelector('#role-sidebar');
const menuToggle = document.querySelector('.role-menu-toggle');
const backdrop = document.querySelector('.role-sidebar-backdrop');
const currentUserKey = 'tms.currentUser';

const rolePages = {
  customer: [
    ['Overview', 'customer-dashboard.html'],
    ['Bookings', 'bookings.html'],
    ['Trips', 'trips.html'],
    ['Notifications', 'notifications.html'],
  ],
  driver: [
    ['Overview', 'driver-dashboard.html'],
    ['Trips', 'trips.html'],
    ['Notifications', 'notifications.html'],
  ],
  admin: [
    ['Overview', 'admin-dashboard.html'],
    ['User management', 'user-management.html'],
    ['Vehicles', 'vehicles.html'],
    ['Drivers', 'drivers.html'],
    ['Trips', 'trips.html'],
    ['Bookings', 'bookings.html'],
    ['Fuel', 'fuel.html'],
    ['Billing', 'billing.html', [
      ['Invoices', 'billing.html?tab=invoices', 'invoices'],
      ['Payments', 'billing.html?tab=payments', 'payments'],
    ]],
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
  ],
};

const roleLabels = {
  customer: 'Customer',
  driver: 'Driver',
  admin: 'Administrator',
};

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
    const roleLabel = sidebar.querySelector('[data-profile-role]');
    if (roleLabel) roleLabel.textContent = roleLabels[currentUser.role];

    const homeLink = sidebar.querySelector('.brand');
    if (homeLink) homeLink.href = links[0][1];

    const navigation = sidebar.querySelector('[data-role-pages]');
    if (navigation) {
      navigation.replaceChildren(...links.map(([label, href, children]) => {
        if (!children) {
          const link = document.createElement('a');
          link.href = href;
          link.textContent = label;
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
        parentLink.textContent = label;
        if (isCurrentParent) parentLink.setAttribute('aria-current', 'page');

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'role-nav-subtoggle';
        toggleBtn.setAttribute('aria-label', `Toggle ${label} sub-navigation`);

        const chevron = document.createElement('span');
        chevron.className = 'role-nav-chevron';
        chevron.textContent = '▼';
        toggleBtn.append(chevron);

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
    if (profileLink && isProfilePage) profileLink.setAttribute('aria-current', 'page');
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
logoutButton?.addEventListener('click', () => {
  sessionStorage.removeItem(currentUserKey);
  window.location.replace('login.html');
});

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
