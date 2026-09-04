// 모바일 메뉴(햄버거 ☰) 열고 닫기
const toggle = document.querySelector(".nav-toggle");
const menu = document.querySelector(".nav-menu");

if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "메뉴 닫기" : "메뉴 열기");
  });
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}
const wishlistStorageKey = "restitch-wishlist";

function readWishlist() {
  try {
    const value = JSON.parse(localStorage.getItem(wishlistStorageKey) || "[]");
    return Array.isArray(value)
      ? value.filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      : [];
  } catch (_) {
    return [];
  }
}

function writeWishlist(items) {
  try {
    localStorage.setItem(wishlistStorageKey, JSON.stringify(items));
  } catch (_) {
    // 저장 공간을 사용할 수 없어도 페이지의 다른 기능은 그대로 유지합니다.
  }
}

function syncWishlistButtons() {
  const wishlist = readWishlist();
  const likedIds = new Set(wishlist.map((item) => item.id));
  document.querySelectorAll("[data-wishlist-toggle]").forEach((button) => {
    const liked = likedIds.has(button.dataset.productId);
    button.setAttribute("aria-pressed", String(liked));
    const icon = button.querySelector("[data-wishlist-icon]");
    if (icon) icon.textContent = liked ? "♥" : "♡";
  });
  document.querySelectorAll('[data-quick-action="wishlist"]').forEach((button) => {
    button.classList.toggle("has-items", wishlist.length > 0);
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-wishlist-toggle]");
  if (!button) return;
  const wishlist = readWishlist();
  const productId = button.dataset.productId;
  const existingIndex = wishlist.findIndex((item) => item.id === productId);
  if (existingIndex >= 0) wishlist.splice(existingIndex, 1);
  else wishlist.push({ id: productId, name: button.dataset.productName || "제품" });
  writeWishlist(wishlist);
  syncWishlistButtons();
});

// 오른쪽 상단의 위치·장바구니·회원 아이콘은 공통 팝업으로 열립니다.
const quickActionButtons = document.querySelectorAll("[data-quick-action]");

if (quickActionButtons.length) {
  const quickDialog = document.createElement("dialog");
  quickDialog.className = "quick-dialog";
  quickDialog.setAttribute("aria-labelledby", "quick-dialog-title");
  quickDialog.innerHTML = `
    <section class="quick-dialog-card">
      <header class="quick-dialog-header">
        <div>
          <p class="quick-dialog-eyebrow" id="quick-dialog-eyebrow"></p>
          <h2 id="quick-dialog-title"></h2>
        </div>
        <form method="dialog">
          <button class="quick-dialog-close" type="submit" aria-label="창 닫기">×</button>
        </form>
      </header>
      <div class="quick-dialog-content" id="quick-dialog-content"></div>
    </section>`;
  document.body.appendChild(quickDialog);

  const eyebrow = document.getElementById("quick-dialog-eyebrow");
  const title = document.getElementById("quick-dialog-title");
  const content = document.getElementById("quick-dialog-content");
  const dialogViews = {
    search: {
      eyebrow: "SEARCH",
      title: "제품 검색",
      body: `
        <form class="header-search-form" data-header-search-form role="search">
          <label class="sr-only" for="header-search-input">제품 검색어</label>
          <div class="header-search-control">
            <input id="header-search-input" name="query" type="search" placeholder="찾으시는 제품을 입력해 주세요" autocomplete="off" required />
            <button type="submit">검색</button>
          </div>
          <p class="header-search-hint">제품명, 카테고리 또는 스타일로 검색해 보세요.</p>
          <div class="header-search-recommend">
            <p>추천 검색어</p>
            <div>
              <a href="products.html?query=원피스#products">원피스</a>
              <a href="products.html?query=블라우스#products">블라우스</a>
              <a href="products.html?query=재킷#products">재킷</a>
              <a href="products.html?query=스커트#products">스커트</a>
            </div>
          </div>
        </form>`
    },
    location: {
      eyebrow: "STORE",
      title: "매장 위치",
      body: `
        <div class="quick-dialog-panel">
          <p class="quick-dialog-message">위브온 중촌 · 맞춤패션 플랫폼</p>
          <p class="quick-dialog-detail">대전광역시 중구 중촌동 410-3, 2층<br />운영 시간: 평일 10:00 – 18:00</p>
          <a class="btn" href="https://map.naver.com/p/search/%EB%8C%80%EC%A0%84%20%EC%A4%91%EA%B5%AC%20%EC%A4%91%EC%B4%8C%EB%8F%99%20410-3" target="_blank" rel="noopener noreferrer">네이버 지도에서 보기</a>
        </div>`
    },
    cart: {
      eyebrow: "SHOPPING BAG",
      title: "장바구니",
      body: `
        <div class="quick-dialog-panel quick-dialog-empty">
          <p class="quick-dialog-message">장바구니에 담긴 제품이 없습니다.</p>
          <a class="btn" href="products.html">제품 둘러보기</a>
        </div>`
    },
    login: {
      eyebrow: "ACCOUNT",
      title: "회원 로그인",
      body: `
        <form class="login-form" data-login-form>
          <label for="member-email">이메일</label>
          <input id="member-email" name="email" type="email" autocomplete="username" placeholder="name@example.com" required />
          <label for="member-password">비밀번호</label>
          <input id="member-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호를 입력하세요" required />
          <label class="login-remember"><input type="checkbox" name="remember" /> 로그인 상태 유지</label>
          <button class="btn" type="submit">로그인</button>
          <p class="login-status" aria-live="polite"></p>
        </form>`
    },
    wishlist: {
      eyebrow: "WISHLIST",
      title: "좋아요",
      body: '<div class="quick-wishlist" data-wishlist-results></div>'
    },
    inquiries: {
      eyebrow: "CONTACT & SERVICE",
      title: "문의하기",
      body: `
        <nav class="service-quick-links" aria-label="문의 및 서비스">
          <a href="email-inquiry.html"><span>이메일 문의</span><span aria-hidden="true">→</span></a>
          <a href="contact.html"><span>전화 문의</span><span aria-hidden="true">→</span></a>
          <a href="https://map.naver.com/p/search/%EB%8C%80%EC%A0%84%20%EC%A4%91%EA%B5%AC%20%EC%A4%91%EC%B4%8C%EB%8F%99%20410-3" target="_blank" rel="noopener noreferrer"><span>매장 위치</span><span aria-hidden="true">→</span></a>
          <a href="contact.html"><span>서비스 센터</span><span aria-hidden="true">→</span></a>
          <span class="service-links-divider" aria-hidden="true"></span>
          <a href="/faq.html" class="service-faq-link"><span>자주 묻는 질문</span><span aria-hidden="true">→</span></a>
        </nav>`
    }
  };

  function renderWishlist() {
    const resultBox = content.querySelector("[data-wishlist-results]");
    if (!resultBox) return;
    const wishlist = readWishlist();
    resultBox.replaceChildren();
    if (!wishlist.length) {
      const empty = document.createElement("p");
      empty.className = "quick-dialog-message quick-dialog-empty";
      empty.textContent = "좋아요를 표시한 제품이 없습니다.";
      resultBox.appendChild(empty);
      return;
    }
    wishlist.forEach((item) => {
      const link = document.createElement("a");
      link.className = "quick-wishlist-item";
      link.href = "product.html?id=" + encodeURIComponent(item.id);
      link.textContent = item.name;
      resultBox.appendChild(link);
    });
  }

  function openQuickDialog(action) {
    const view = dialogViews[action];
    if (!view) return;
    quickDialog.dataset.view = action;
    eyebrow.textContent = view.eyebrow;
    title.textContent = view.title;
    content.innerHTML = view.body;
    if (action === "wishlist") renderWishlist();
    if (!quickDialog.open) quickDialog.showModal();
    const firstInput = content.querySelector("input");
    if (firstInput) firstInput.focus();
  }

  window.openRestitchQuickDialog = openQuickDialog;

  quickActionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.quickAction === "login") {
        window.location.href = "login.html";
        return;
      }
      openQuickDialog(button.dataset.quickAction);
    });
  });

  quickDialog.addEventListener("submit", (event) => {
    if (event.target.matches("[data-header-search-form]")) {
      event.preventDefault();
      const query = event.target.elements.query.value.trim();
      window.location.href = query
        ? "products.html?query=" + encodeURIComponent(query) + "#products"
        : "products.html#products";
    } else if (event.target.matches("[data-login-form]")) {
      event.preventDefault();
      event.target.querySelector(".login-status").textContent =
        "회원 로그인 서비스는 현재 준비 중입니다.";
    }
  });

  quickDialog.addEventListener("click", (event) => {
    if (event.target === quickDialog) quickDialog.close();
  });
}

syncWishlistButtons();

if (new URLSearchParams(window.location.search).get("dialog") === "search" &&
    typeof window.openRestitchQuickDialog === "function") {
  requestAnimationFrame(() => window.openRestitchQuickDialog("search"));
}

// 홈을 제외한 주요 페이지의 배너 아래에 제품 검색창을 배치합니다.
const siteSearchBanner = document.querySelector(".hero:not(.home-hero), .page-head");
if (siteSearchBanner && !document.getElementById("catalog-search")) {
  const siteSearchBand = document.createElement("section");
  siteSearchBand.className = "catalog-search-band site-search-band";
  siteSearchBand.setAttribute("aria-label", "제품 검색");
  siteSearchBand.innerHTML = `
    <form class="catalog-page-search" data-site-search-form role="search">
      <label class="sr-only" for="site-search-input">제품 검색어</label>
      <input id="site-search-input" name="query" type="search" placeholder="제품명, 종류 또는 키워드를 검색하세요" />
      <button type="submit" aria-label="검색">검색</button>
    </form>`;
  siteSearchBanner.insertAdjacentElement("afterend", siteSearchBand);
}

document.querySelectorAll("[data-site-search-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = form.elements.query.value.trim();
    const target = query ? "products.html?query=" + encodeURIComponent(query) + "#products" : "products.html#products";
    window.location.href = target;
  });
});

// 스크롤 중에도 따라오는 원형 검색 버튼입니다.
const floatingSearchButton = document.createElement("button");
floatingSearchButton.className = "floating-search";
floatingSearchButton.type = "button";
floatingSearchButton.setAttribute("aria-label", "빠른 메뉴 열기");
floatingSearchButton.setAttribute("aria-expanded", "false");
floatingSearchButton.setAttribute("aria-controls", "floating-quick-menu");
floatingSearchButton.title = "빠른 메뉴";
floatingSearchButton.innerHTML =
  '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';
document.body.appendChild(floatingSearchButton);

const floatingQuickMenu = document.createElement("div");
floatingQuickMenu.className = "floating-quick-menu";
floatingQuickMenu.id = "floating-quick-menu";
floatingQuickMenu.hidden = true;
floatingQuickMenu.innerHTML = `
  <button type="button" data-floating-action="search">
    <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
    <span><small>SEARCH</small>제품 검색</span>
  </button>
  <button type="button" data-floating-action="inquiries">
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 5h14v11H9l-4 3V5Z"/><path d="M8 9h8M8 12h5"/></svg>
    <span><small>CONTACT & SERVICE</small>문의하기</span>
  </button>
  <button type="button" data-floating-action="wishlist">
    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg>
    <span><small>WISHLIST</small>좋아요 제품</span>
  </button>`;
document.body.appendChild(floatingQuickMenu);

function openCatalogSearch() {
  const searchInput = document.getElementById("catalog-search-input");
  if (!searchInput) {
    window.location.href = "products.html?search=open#catalog-search";
    return;
  }
  document.getElementById("catalog-search").scrollIntoView({ behavior: "smooth", block: "center" });
  searchInput.focus({ preventScroll: true });
}

function closeFloatingQuickMenu() {
  floatingQuickMenu.hidden = true;
  floatingSearchButton.setAttribute("aria-expanded", "false");
}

floatingSearchButton.addEventListener("click", () => {
  const willOpen = floatingQuickMenu.hidden;
  floatingQuickMenu.hidden = !willOpen;
  floatingSearchButton.setAttribute("aria-expanded", String(willOpen));
});

floatingQuickMenu.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-floating-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.floatingAction;
  closeFloatingQuickMenu();
  if (action === "search") openCatalogSearch();
  else if (typeof window.openRestitchQuickDialog === "function") window.openRestitchQuickDialog(action);
});

document.addEventListener("click", (event) => {
  if (floatingQuickMenu.hidden || floatingQuickMenu.contains(event.target) || floatingSearchButton.contains(event.target)) return;
  closeFloatingQuickMenu();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeFloatingQuickMenu();
});

if (new URLSearchParams(window.location.search).get("search") === "open") {
  requestAnimationFrame(openCatalogSearch);
}

// 정식 전송 API가 연결되기 전에는 입력 내용을 전송하지 않고 안내만 표시합니다.
const emailInquiryPageForm = document.querySelector("[data-email-inquiry-page-form]");
if (emailInquiryPageForm) {
  emailInquiryPageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    emailInquiryPageForm.querySelector(".email-inquiry-status").textContent =
      "문의 양식이 작성되었습니다. 운영 이메일 연결 후 전송할 수 있습니다.";
  });
}

// 로그인과 계정 생성은 별도 페이지에서 입력 내용을 확인합니다.
document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = button.closest(".auth-password")?.querySelector("input");
    if (!input) return;
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    button.textContent = willShow ? "숨기기" : "보기";
  });
});

const agreeAll = document.querySelector("[data-agree-all]");
const consentInputs = document.querySelectorAll("[data-required-consent], [data-optional-consent]");
if (agreeAll) {
  agreeAll.addEventListener("change", () => {
    consentInputs.forEach((input) => { input.checked = agreeAll.checked; });
  });
  consentInputs.forEach((input) => {
    input.addEventListener("change", () => {
      agreeAll.checked = Array.from(consentInputs).every((item) => item.checked);
    });
  });
}

document.querySelectorAll("[data-auth-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = form.querySelector(".auth-status");
    if (form.dataset.authForm === "signup") {
      if (form.elements.email.value !== form.elements.emailConfirm.value) {
        status.textContent = "이메일 주소가 서로 일치하지 않습니다.";
        form.elements.emailConfirm.focus();
        return;
      }
      if (form.elements.password.value !== form.elements.passwordConfirm.value) {
        status.textContent = "비밀번호가 서로 일치하지 않습니다.";
        form.elements.passwordConfirm.focus();
        return;
      }
      status.textContent = "계정 생성 화면이 완성되었습니다. 회원 시스템 연결 후 가입할 수 있습니다.";
      return;
    }
    status.textContent = "로그인 화면이 완성되었습니다. 회원 시스템 연결 후 로그인할 수 있습니다.";
  });
});

document.querySelectorAll("[data-auth-placeholder]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const status = link.closest(".auth-form")?.querySelector(".auth-status");
    if (status) status.textContent = "비밀번호 찾기는 회원 시스템 연결 후 이용할 수 있습니다.";
  });
});

document.querySelectorAll("[data-service-placeholder]").forEach((button) => {
  button.addEventListener("click", () => {
    window.alert("카카오톡 상담 채널을 준비 중입니다.");
  });
});
