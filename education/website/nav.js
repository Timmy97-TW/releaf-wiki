// nav.js — shared bilingual header + footer
// English pages live in root folder.
// Mandarin pages live in /zh/.

const isChinese = window.location.pathname.includes('/zh/');

/* EDIT THESE */
const CONTACT = {
  instagram: 'https://www.instagram.com/gems_taiwan/',
  youtube: 'https://www.youtube.com/@gemstaiwan4743/featured',
  email: 'social.media@gems.com.tw',
  phoneDisplay: '+886 287 924 755',
  phoneLink: '+886287924755',
  maps: 'https://www.google.com/maps/search/?api=1&query=2F.-1%2C%20No.%2015%2C%20Ln.%20374%2C%20Sec.%203%2C%20Chenggong%20Rd.%2C%20Neihu%20Dist.%2C%20Taipei%2C%20Taiwan'
};

const PAGES_EN = [
  { href: 'index.html', label: 'Home' },
  { href: 'about.html', label: 'About Us' },
  { href: 'resources.html', label: 'Resources' },
  { href: 'ethics.html', label: 'Science & Ethics' },
  { href: 'play.html', label: 'Online Games' },
  { href: 'blog.html', label: 'Blogs & News' },
  { href: 'involved.html', label: 'Get Involved' },
];

const PAGES_ZH = [
  { href: 'index.html', label: '首頁' },
  { href: 'about.html', label: '關於我們' },
  { href: 'resources.html', label: '教材資源' },
  { href: 'ethics.html', label: '科學與倫理' },
  { href: 'play.html', label: '線上遊戲' },
  { href: 'blog.html', label: '部落格與消息' },
  { href: 'involved.html', label: '參與我們' },
];

function getCurrentFileName() {
  const path = window.location.pathname;
  const file = path.substring(path.lastIndexOf('/') + 1);
  return file || 'index.html';
}

function getPageHref(pageFile) {
  return pageFile;
}

function getLanguageSwitchHref() {
  const currentFile = getCurrentFileName();

  if (isChinese) {
    return `../${currentFile}`;
  } else {
    return `zh/${currentFile}`;
  }
}

function injectHeader() {
  const active = window.ACTIVE_PAGE || getCurrentFileName();
  const pages = isChinese ? PAGES_ZH : PAGES_EN;

  const links = pages.map(p =>
    `<a href="${getPageHref(p.href)}"${active === p.href ? ' class="active"' : ''}>${p.label}</a>`
  ).join('');

  const langHref = getLanguageSwitchHref();
  const langLabel = isChinese ? 'English' : '中文';

  document.body.insertAdjacentHTML('afterbegin', `
<header>
  <div class="header-inner">
    <nav>
      ${links}
      <a class="lang-switch" href="${langHref}">${langLabel}</a>
    </nav>
  </div>
</header>`);
}

function injectFooter() {
  const footerLogo = 'GEMS Taiwan';

  const addressLabel = isChinese ? '地址' : 'Address';
  const contactLabel = isChinese ? '聯絡我們' : 'Contact';
  const socialLabel = isChinese ? '社群媒體' : 'Social Media';
  const mapLabel = isChinese ? '在 Google Maps 查看' : 'View on Google Maps';

  const address = isChinese
    ? '台灣台北市內湖區成功路三段374巷15號2樓之1'
    : '2F.-1, No. 15, Ln. 374, Sec. 3, Chenggong Rd., Neihu Dist., Taipei, Taiwan (R.O.C.)';

  document.body.insertAdjacentHTML('beforeend', `
<footer class="site-footer">
  <div class="footer-inner">

    <div class="footer-col footer-brand">
      <p class="footer-logo">${footerLogo}</p>
      <p class="footer-tagline">
        ${isChinese
          ? 'Connecting synthetic biology, education, and community impact.'
          : 'Connecting synthetic biology, education, and community impact.'}
      </p>
    </div>

    <div class="footer-col">
      <p class="footer-heading">${addressLabel}</p>
      <p class="footer-text">${address}</p>
      <a class="footer-link" href="${CONTACT.maps}" target="_blank" rel="noopener noreferrer">
        ${mapLabel}
      </a>
    </div>

    <div class="footer-col">
      <p class="footer-heading">${contactLabel}</p>
      <a class="footer-link" href="mailto:${CONTACT.email}">${CONTACT.email}</a>
      <a class="footer-link" href="tel:${CONTACT.phoneLink}">${CONTACT.phoneDisplay}</a>
    </div>

    <div class="footer-col">
      <p class="footer-heading">${socialLabel}</p>
      <div class="footer-socials">
        <a href="${CONTACT.instagram}" target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href="${CONTACT.youtube}" target="_blank" rel="noopener noreferrer">YouTube</a>
      </div>
    </div>

  </div>

  <div class="footer-bottom">
    <p>© ${new Date().getFullYear()} GEMS Taiwan. All rights reserved.</p>
  </div>
</footer>`);
}

document.addEventListener('DOMContentLoaded', () => {
  injectHeader();
  injectFooter();
});