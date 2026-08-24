// 브랜드 담당자가 사용하는 제품 편집기입니다. GitHub 권한이나 비밀번호는 브라우저에 저장하지 않습니다.
(function () {
  "use strict";

  const state = {
    catalog: null,
    sha: "",
    currentId: "",
    dirty: false,
    uploading: 0,
    forcedPasswordChange: false,
  };
  let toastTimer;
  const toastEditors = new Map();

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const elements = {
    loading: $("#loadingView"),
    login: $("#loginView"),
    loginForm: $("#loginForm"),
    loginError: $("#loginError"),
    password: $("#password"),
    passwordToggle: $("#passwordToggle"),
    app: $("#adminApp"),
    changePassword: $("#changePasswordButton"),
    logout: $("#logoutButton"),
    saveState: $("#saveState"),
    sidebar: $("#productSidebar"),
    productCount: $("#productCount"),
    productSearch: $("#productSearch"),
    productList: $("#productList"),
    newProduct: $("#newProductButton"),
    emptyEditor: $("#emptyEditor"),
    productForm: $("#productForm"),
    editorProductName: $("#editorProductName"),
    mobileList: $("#mobileListButton"),
    preview: $("#previewLink"),
    save: $("#saveButton"),
    mainImageInput: $("#mainImageInput"),
    mainImageDrop: $("#mainImageDrop"),
    mainImageGrid: $("#mainImageGrid"),
    mainImageEmpty: $("#mainImageEmpty"),
    sectionList: $("#sectionList"),
    deleteProduct: $("#deleteProductButton"),
    passwordDialog: $("#passwordDialog"),
    passwordForm: $("#passwordForm"),
    passwordDialogTitle: $("#passwordDialogTitle"),
    passwordDialogLead: $("#passwordDialogLead"),
    currentPassword: $("#currentPassword"),
    newPassword: $("#newPassword"),
    confirmPassword: $("#confirmPassword"),
    passwordError: $("#passwordError"),
    passwordCancel: $("#passwordCancelButton"),
    passwordSubmit: $("#passwordSubmitButton"),
    toast: $("#toast"),
  };

  const blockNames = {
    rich_text: "글",
    full_image: "큰 이미지",
    image_text: "이미지와 글",
    gallery: "이미지 갤러리",
    highlight: "강조 문구",
  };

  boot();

  async function boot() {
    bindEvents();
    try {
      const session = await api("/api/admin/session");
      if (session.authenticated && session.mustChange) openPasswordDialog(true);
      else if (session.authenticated) await openAdmin();
      else showLogin();
    } catch (error) {
      showLogin(error.message);
    }
  }

  function bindEvents() {
    elements.loginForm.addEventListener("submit", handleLogin);
    elements.passwordToggle.addEventListener("click", () => {
      const visible = elements.password.type === "text";
      elements.password.type = visible ? "password" : "text";
      elements.passwordToggle.textContent = visible ? "보기" : "숨김";
    });
    elements.changePassword.addEventListener("click", () => openPasswordDialog(false));
    elements.passwordForm.addEventListener("submit", handlePasswordChange);
    elements.passwordCancel.addEventListener("click", closePasswordDialog);
    elements.passwordDialog.addEventListener("cancel", (event) => {
      if (state.forcedPasswordChange) event.preventDefault();
    });
    elements.logout.addEventListener("click", handleLogout);
    elements.newProduct.addEventListener("click", addProduct);
    elements.productSearch.addEventListener("input", renderProductList);
    elements.mobileList.addEventListener("click", () => document.body.classList.remove("editor-open"));
    elements.productForm.addEventListener("submit", saveCatalog);
    elements.productForm.addEventListener("input", handleProductField);
    elements.productForm.addEventListener("change", handleProductField);
    elements.deleteProduct.addEventListener("click", deleteCurrentProduct);
    elements.mainImageInput.addEventListener("change", async (event) => {
      await addMainImages(event.target.files);
      event.target.value = "";
    });
    elements.mainImageEmpty.addEventListener("click", () => elements.mainImageInput.click());
    elements.mainImageGrid.addEventListener("click", handleMainImageAction);
    elements.mainImageDrop.addEventListener("dragover", (event) => {
      event.preventDefault();
      elements.mainImageDrop.classList.add("dragging");
    });
    elements.mainImageDrop.addEventListener("dragleave", () => elements.mainImageDrop.classList.remove("dragging"));
    elements.mainImageDrop.addEventListener("drop", async (event) => {
      event.preventDefault();
      elements.mainImageDrop.classList.remove("dragging");
      await addMainImages(event.dataTransfer.files);
    });
    elements.sectionList.addEventListener("click", handleSectionClick);
    elements.sectionList.addEventListener("input", handleSectionField);
    elements.sectionList.addEventListener("change", handleSectionChange);
    document.querySelectorAll("[data-add-block]").forEach((button) => button.addEventListener("click", () => addBlock(button.dataset.addBlock)));
    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  async function handleLogin(event) {
    event.preventDefault();
    elements.loginError.hidden = true;
    const button = $("button[type='submit']", elements.loginForm);
    button.disabled = true;
    button.textContent = "확인 중…";
    try {
      const enteredPassword = elements.password.value;
      const result = await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: enteredPassword }),
      });
      elements.password.value = "";
      if (result.mustChange) openPasswordDialog(true, enteredPassword);
      else await openAdmin();
    } catch (error) {
      elements.loginError.textContent = error.message;
      elements.loginError.hidden = false;
      elements.password.focus();
    } finally {
      button.disabled = false;
      button.textContent = "관리 화면 열기";
    }
  }

  function openPasswordDialog(forced, currentPassword = "") {
    state.forcedPasswordChange = forced;
    elements.passwordForm.reset();
    elements.currentPassword.value = currentPassword;
    elements.passwordError.hidden = true;
    elements.passwordCancel.hidden = forced;
    elements.passwordDialogTitle.textContent = forced ? "처음 사용할 비밀번호를 정해주세요." : "관리자 비밀번호 변경";
    elements.passwordDialogLead.textContent = forced
      ? "초기 비밀번호 0000은 임시 비밀번호입니다. 제품 관리 전에 브랜드 전용 비밀번호로 변경해 주세요."
      : "변경하면 다른 기기에 남아 있는 기존 로그인은 모두 해제됩니다.";
    if (forced) {
      elements.loading.hidden = true;
      elements.login.hidden = true;
      elements.app.hidden = true;
    }
    if (!elements.passwordDialog.open) elements.passwordDialog.showModal();
    window.setTimeout(() => (currentPassword ? elements.newPassword : elements.currentPassword).focus(), 50);
  }

  function closePasswordDialog() {
    if (state.forcedPasswordChange) return;
    elements.passwordDialog.close();
    elements.passwordForm.reset();
  }

  async function handlePasswordChange(event) {
    event.preventDefault();
    elements.passwordError.hidden = true;
    if (elements.newPassword.value !== elements.confirmPassword.value) {
      elements.passwordError.textContent = "새 비밀번호가 서로 일치하지 않습니다.";
      elements.passwordError.hidden = false;
      elements.confirmPassword.focus();
      return;
    }
    if (elements.newPassword.value.length < 8) {
      elements.passwordError.textContent = "새 비밀번호를 8자 이상 입력해 주세요.";
      elements.passwordError.hidden = false;
      elements.newPassword.focus();
      return;
    }

    elements.passwordSubmit.disabled = true;
    elements.passwordSubmit.textContent = "변경 중…";
    try {
      await api("/api/admin/password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: elements.currentPassword.value,
          newPassword: elements.newPassword.value,
        }),
      });
      const wasForced = state.forcedPasswordChange;
      state.forcedPasswordChange = false;
      elements.passwordDialog.close();
      elements.passwordForm.reset();
      if (wasForced) await openAdmin();
      else showToast("관리자 비밀번호를 변경했습니다. 다른 기기의 기존 로그인은 해제됩니다.");
    } catch (error) {
      elements.passwordError.textContent = error.message;
      elements.passwordError.hidden = false;
    } finally {
      elements.passwordSubmit.disabled = false;
      elements.passwordSubmit.textContent = "비밀번호 변경";
    }
  }

  async function handleLogout() {
    if (state.dirty && !window.confirm("저장하지 않은 변경사항이 있습니다. 그래도 로그아웃할까요?")) return;
    try { await api("/api/admin/logout", { method: "POST", body: "{}" }); } catch (_) {}
    state.catalog = null;
    state.sha = "";
    state.currentId = "";
    state.forcedPasswordChange = false;
    if (elements.passwordDialog.open) elements.passwordDialog.close();
    setDirty(false);
    showLogin();
  }

  function showLogin(message = "") {
    elements.loading.hidden = true;
    elements.app.hidden = true;
    elements.login.hidden = false;
    document.body.classList.remove("editor-open");
    if (message) {
      elements.loginError.textContent = message;
      elements.loginError.hidden = false;
    }
    window.setTimeout(() => elements.password.focus(), 50);
  }

  async function openAdmin() {
    elements.loading.hidden = false;
    elements.login.hidden = true;
    elements.app.hidden = true;
    try {
      const data = await api("/api/admin/catalog");
      state.catalog = data.catalog;
      state.sha = data.sha;
      state.currentId = state.catalog.products[0]?.id || "";
      setDirty(false);
      renderProductList();
      renderEditor();
      elements.loading.hidden = true;
      elements.app.hidden = false;
    } catch (error) {
      elements.loading.hidden = true;
      if (error.status === 401) showLogin();
      else showLogin(error.message);
    }
  }

  function currentProduct() {
    return state.catalog?.products.find((product) => product.id === state.currentId) || null;
  }

  function renderProductList() {
    if (!state.catalog) return;
    const query = elements.productSearch.value.trim().toLowerCase();
    const products = state.catalog.products.filter((product) => {
      const source = `${product.name || ""} ${product.category || ""} ${product.label || ""}`.toLowerCase();
      return !query || source.includes(query);
    });
    elements.productCount.textContent = String(state.catalog.products.length);
    elements.productList.replaceChildren();

    if (!products.length) {
      const empty = create("p", "list-empty", query ? "검색 결과가 없습니다." : "아직 등록된 제품이 없습니다.\n＋ 버튼으로 첫 제품을 추가하세요.");
      elements.productList.append(empty);
      return;
    }

    products.forEach((product) => {
      const button = create("button", `product-item${product.id === state.currentId ? " active" : ""}`);
      button.type = "button";
      button.dataset.productId = product.id;
      button.addEventListener("click", () => selectProduct(product.id));

      const thumb = create("span", "product-thumb");
      if (product.images?.[0]) {
        const image = document.createElement("img");
        image.src = imageUrl(product.images[0]);
        image.alt = "";
        image.loading = "lazy";
        thumb.append(image);
      } else {
        thumb.append(create("span", "", "＋"));
      }

      const copy = create("span", "product-item-copy");
      copy.append(create("strong", "", product.name || "이름 없는 제품"));
      copy.append(create("span", "", [product.label, product.category].filter(Boolean).join(" · ") || "기본 정보 입력 전"));
      button.append(thumb, copy, create("span", `status-dot${product.published !== false ? " on" : ""}`));
      elements.productList.append(button);
    });
  }

  function selectProduct(id) {
    if (state.currentId === id) {
      document.body.classList.add("editor-open");
      return;
    }
    state.currentId = id;
    renderProductList();
    renderEditor();
    document.body.classList.add("editor-open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addProduct() {
    const product = {
      id: crypto.randomUUID(),
      published: false,
      featured: false,
      label: "NEW",
      name: "새 제품",
      summary: "",
      category: "",
      price: "",
      keywords: [],
      images: [],
      buyLabel: "구매하기",
      buyLink: "",
      sections: [],
    };
    state.catalog.products.unshift(product);
    state.currentId = product.id;
    setDirty(true);
    renderProductList();
    renderEditor();
    document.body.classList.add("editor-open");
    $("[data-field='name']", elements.productForm).select();
  }

  function renderEditor() {
    const product = currentProduct();
    const hasProduct = Boolean(product);
    elements.emptyEditor.hidden = hasProduct;
    elements.productForm.hidden = !hasProduct;
    if (!product) return;

    elements.editorProductName.textContent = product.name || "제품 편집";
    elements.preview.href = `product.html?id=${encodeURIComponent(product.id)}`;
    elements.productForm.querySelectorAll("[data-field]").forEach((input) => {
      const field = input.dataset.field;
      if (input.type === "checkbox") input.checked = Boolean(product[field]);
      else if (field === "keywords") input.value = Array.isArray(product.keywords) ? product.keywords.join(", ") : "";
      else input.value = product[field] || "";
    });
    renderMainImages();
    renderSections();
  }

  function handleProductField(event) {
    const input = event.target.closest("[data-field]");
    const product = currentProduct();
    if (!input || !product) return;
    const field = input.dataset.field;
    if (input.type === "checkbox") product[field] = input.checked;
    else if (field === "keywords") product.keywords = input.value.split(",").map((item) => item.trim()).filter(Boolean);
    else product[field] = input.value;
    elements.editorProductName.textContent = product.name || "제품 편집";
    setDirty(true);
    renderProductList();
  }

  function renderMainImages() {
    const product = currentProduct();
    elements.mainImageGrid.replaceChildren();
    (product?.images || []).forEach((path, index) => {
      const card = imageCard(path, index, product.images.length, "main");
      if (index === 0) card.append(create("span", "image-badge", "대표"));
      elements.mainImageGrid.append(card);
    });
    elements.mainImageEmpty.hidden = Boolean(product?.images?.length);
  }

  function imageCard(path, index, length, scope) {
    const card = create("div", "image-card");
    const image = document.createElement("img");
    image.src = imageUrl(path);
    image.alt = "제품 이미지";
    image.loading = "lazy";
    card.append(image);
    const actions = create("div", "image-actions");
    if (index > 0) actions.append(actionButton("←", `${scope}-left`, index, "앞으로 이동"));
    if (index < length - 1) actions.append(actionButton("→", `${scope}-right`, index, "뒤로 이동"));
    actions.append(actionButton("×", `${scope}-remove`, index, "이미지 제거"));
    card.append(actions);
    return card;
  }

  function actionButton(label, action, index, title) {
    const button = create("button", "", label);
    button.type = "button";
    button.dataset.imageAction = action;
    button.dataset.imageIndex = String(index);
    button.title = title;
    return button;
  }

  async function addMainImages(files) {
    const product = currentProduct();
    if (!product || !files?.length) return;
    const paths = await uploadFiles(files, product.id);
    product.images.push(...paths);
    if (paths.length) setDirty(true);
    renderMainImages();
  }

  function handleMainImageAction(event) {
    const button = event.target.closest("[data-image-action]");
    const product = currentProduct();
    if (!button || !product) return;
    const index = Number(button.dataset.imageIndex);
    const action = button.dataset.imageAction;
    if (action.endsWith("remove")) product.images.splice(index, 1);
    if (action.endsWith("left") && index > 0) [product.images[index - 1], product.images[index]] = [product.images[index], product.images[index - 1]];
    if (action.endsWith("right") && index < product.images.length - 1) [product.images[index + 1], product.images[index]] = [product.images[index], product.images[index + 1]];
    setDirty(true);
    renderMainImages();
    renderProductList();
  }

  function renderSections() {
    const product = currentProduct();
    destroyToastEditors();
    elements.sectionList.replaceChildren();
    (product?.sections || []).forEach((section, index) => elements.sectionList.append(buildSection(section, index)));
    mountToastEditors();
  }

  function buildSection(section, index) {
    const card = create("article", "section-card");
    card.dataset.sectionIndex = String(index);
    const header = create("header", "section-card-header");
    const title = create("strong");
    title.append(create("span", "", String(index + 1).padStart(2, "0")), document.createTextNode(blockNames[section.type] || section.type));
    const actions = create("div", "section-actions");
    if (index > 0) actions.append(sectionAction("↑", "up", index, "위로 이동"));
    const product = currentProduct();
    if (index < product.sections.length - 1) actions.append(sectionAction("↓", "down", index, "아래로 이동"));
    actions.append(sectionAction("×", "remove", index, "블록 삭제"));
    header.append(title, actions);

    const body = create("div", "section-body");
    if (section.type === "rich_text") body.append(richEditor(index, "body", section.body, "제품 이야기를 자유롭게 작성하세요."));
    if (section.type === "full_image") {
      body.append(sectionImageBox(index, "image", section.image));
      body.append(sectionTextField(index, "alt", "이미지 설명", section.alt, "사진을 보지 못하는 사람을 위한 설명"));
      body.append(sectionTextField(index, "caption", "사진 아래 문구", section.caption, "선택 입력"));
    }
    if (section.type === "image_text") {
      const columns = create("div", "section-columns");
      columns.append(sectionImageBox(index, "image", section.image));
      const copy = create("div");
      copy.append(sectionSelect(index, "imagePosition", "이미지 위치", section.imagePosition || "left", [["left", "왼쪽"], ["right", "오른쪽"]]));
      copy.append(sectionTextField(index, "heading", "제목", section.heading, "섹션 제목"));
      columns.append(copy);
      body.append(columns, richEditor(index, "body", section.body, "이미지와 함께 표시할 내용을 작성하세요."));
    }
    if (section.type === "gallery") {
      body.append(sectionSelect(index, "columns", "한 줄 이미지 수", String(section.columns || "2"), [["1", "1장"], ["2", "2장"], ["3", "3장"]]));
      body.append(galleryEditor(index, section.images || []));
    }
    if (section.type === "highlight") {
      body.append(sectionTextField(index, "heading", "강조 제목", section.heading, "핵심 메시지"));
      body.append(richEditor(index, "body", section.body, "강조할 내용을 작성하세요."));
    }
    card.append(header, body);
    return card;
  }

  function sectionAction(label, action, index, title) {
    const button = create("button", "", label);
    button.type = "button";
    button.dataset.sectionAction = action;
    button.dataset.sectionIndex = String(index);
    button.title = title;
    return button;
  }

  function sectionTextField(index, field, label, value, placeholder) {
    const wrapper = create("label", "section-field");
    wrapper.append(create("span", "", label));
    const input = document.createElement(field === "caption" ? "textarea" : "input");
    input.value = value || "";
    input.placeholder = placeholder || "";
    input.dataset.sectionIndex = String(index);
    input.dataset.sectionField = field;
    wrapper.append(input);
    return wrapper;
  }

  function sectionSelect(index, field, label, value, options) {
    const wrapper = create("label", "section-field");
    wrapper.append(create("span", "", label));
    const select = document.createElement("select");
    select.dataset.sectionIndex = String(index);
    select.dataset.sectionField = field;
    options.forEach(([optionValue, optionLabel]) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionLabel;
      option.selected = optionValue === value;
      select.append(option);
    });
    wrapper.append(select);
    return wrapper;
  }

  function sectionImageBox(index, field, path) {
    const box = create("div", "section-image-box");
    if (path) {
      const image = document.createElement("img");
      image.src = imageUrl(path);
      image.alt = "상세 이미지";
      box.append(image);
      const tools = create("div", "section-image-tools");
      tools.append(uploadLabel(index, field, "변경"));
      const remove = create("button", "", "삭제");
      remove.type = "button";
      remove.dataset.clearSectionImage = "true";
      remove.dataset.sectionIndex = String(index);
      remove.dataset.sectionField = field;
      tools.append(remove);
      box.append(tools);
    } else {
      const label = create("label", "section-image-empty");
      label.append(create("span", "", "＋"), create("strong", "", "이미지 추가"));
      label.append(makeUploadInput(index, field, false));
      box.append(label);
    }
    return box;
  }

  function uploadLabel(index, field, labelText, multiple = false) {
    const label = create("label", "", labelText);
    label.append(makeUploadInput(index, field, multiple));
    return label;
  }

  function makeUploadInput(index, field, multiple) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
    input.multiple = multiple;
    input.hidden = true;
    input.dataset.sectionUpload = field;
    input.dataset.sectionIndex = String(index);
    return input;
  }

  function galleryEditor(index, images) {
    const wrapper = create("div");
    const gallery = create("div", "mini-gallery");
    images.forEach((path, imageIndex) => {
      const card = imageCard(path, imageIndex, images.length, "gallery");
      card.querySelectorAll("[data-image-action]").forEach((button) => button.dataset.sectionIndex = String(index));
      gallery.append(card);
    });
    const add = create("label", "upload-button", "갤러리 이미지 추가");
    add.style.marginTop = "10px";
    add.append(makeUploadInput(index, "images", true));
    wrapper.append(gallery, add);
    return wrapper;
  }

  function richEditor(index, field, html, placeholder) {
    const mount = create("div", "toast-editor-mount");
    mount.dataset.sectionIndex = String(index);
    mount.dataset.richField = field;
    mount.dataset.placeholder = placeholder;
    return mount;
  }

  function mountToastEditors() {
    const product = currentProduct();
    if (!product) return;

    elements.sectionList.querySelectorAll(".toast-editor-mount").forEach((mount) => {
      const index = Number(mount.dataset.sectionIndex);
      const field = mount.dataset.richField;
      const initialHtml = sanitizeEditorHtml(product.sections[index]?.[field] || "");

      if (!window.toastui?.Editor) {
        const fallback = document.createElement("textarea");
        fallback.className = "toast-editor-fallback";
        fallback.value = initialHtml;
        fallback.dataset.sectionIndex = String(index);
        fallback.dataset.richFallback = field;
        fallback.placeholder = mount.dataset.placeholder;
        mount.append(fallback);
        return;
      }

      let ready = false;
      let editor;
      editor = new window.toastui.Editor({
        el: mount,
        height: "330px",
        minHeight: "240px",
        initialEditType: "wysiwyg",
        previewStyle: "tab",
        hideModeSwitch: true,
        language: "ko-KR",
        autofocus: false,
        usageStatistics: false,
        placeholder: mount.dataset.placeholder,
        toolbarItems: [
          ["heading", "bold", "italic", "strike"],
          ["hr", "quote"],
          ["ul", "ol"],
          ["link", "image"],
        ],
        hooks: {
          addImageBlobHook: async (blob, callback) => {
            const paths = await uploadFiles([blob], product.id);
            if (paths[0]) callback(imageUrl(paths[0]), blob.name || "본문 이미지");
          },
        },
        events: {
          change: () => {
            if (!ready) return;
            const section = product.sections[index];
            if (!section) return;
            section[field] = sanitizeEditorHtml(editor.getHTML());
            setDirty(true);
          },
        },
      });
      editor.setHTML(initialHtml, false);
      ready = true;
      toastEditors.set(`${index}:${field}`, editor);
    });
  }

  function destroyToastEditors() {
    toastEditors.forEach((editor) => {
      try { editor.destroy(); } catch (_) {}
    });
    toastEditors.clear();
  }

  function syncToastEditors() {
    const product = currentProduct();
    if (!product) return;
    toastEditors.forEach((editor, key) => {
      const [index, field] = key.split(":");
      if (product.sections[Number(index)]) product.sections[Number(index)][field] = sanitizeEditorHtml(editor.getHTML());
    });
  }

  function handleSectionClick(event) {
    const sectionButton = event.target.closest("[data-section-action]");
    const product = currentProduct();
    if (sectionButton && product) {
      const index = Number(sectionButton.dataset.sectionIndex);
      const action = sectionButton.dataset.sectionAction;
      if (action === "remove" && !window.confirm("이 상세 블록을 삭제할까요?")) return;
      if (action === "remove") product.sections.splice(index, 1);
      if (action === "up" && index > 0) [product.sections[index - 1], product.sections[index]] = [product.sections[index], product.sections[index - 1]];
      if (action === "down" && index < product.sections.length - 1) [product.sections[index + 1], product.sections[index]] = [product.sections[index], product.sections[index + 1]];
      setDirty(true);
      renderSections();
      return;
    }

    const clearButton = event.target.closest("[data-clear-section-image]");
    if (clearButton && product) {
      const section = product.sections[Number(clearButton.dataset.sectionIndex)];
      section[clearButton.dataset.sectionField] = "";
      setDirty(true);
      renderSections();
      return;
    }

    const imageButton = event.target.closest("[data-image-action^='gallery-']");
    if (imageButton && product) {
      const section = product.sections[Number(imageButton.dataset.sectionIndex)];
      const images = section.images;
      const index = Number(imageButton.dataset.imageIndex);
      const action = imageButton.dataset.imageAction;
      if (action.endsWith("remove")) images.splice(index, 1);
      if (action.endsWith("left") && index > 0) [images[index - 1], images[index]] = [images[index], images[index - 1]];
      if (action.endsWith("right") && index < images.length - 1) [images[index + 1], images[index]] = [images[index], images[index + 1]];
      setDirty(true);
      renderSections();
    }
  }

  function handleSectionField(event) {
    const product = currentProduct();
    if (!product) return;
    const fallback = event.target.closest("[data-rich-fallback]");
    if (fallback) {
      product.sections[Number(fallback.dataset.sectionIndex)][fallback.dataset.richFallback] = sanitizeEditorHtml(fallback.value);
      setDirty(true);
      return;
    }
    const field = event.target.closest("[data-section-field]");
    if (field) {
      product.sections[Number(field.dataset.sectionIndex)][field.dataset.sectionField] = field.value;
      setDirty(true);
    }
  }

  async function handleSectionChange(event) {
    const input = event.target.closest("[data-section-upload]");
    if (!input || !input.files?.length) return;
    const product = currentProduct();
    const index = Number(input.dataset.sectionIndex);
    const field = input.dataset.sectionUpload;
    const paths = await uploadFiles(input.files, product.id);
    if (field === "images") product.sections[index].images.push(...paths);
    else if (paths[0]) product.sections[index][field] = paths[0];
    if (paths.length) setDirty(true);
    renderSections();
  }

  function addBlock(type) {
    const product = currentProduct();
    if (!product) return;
    const defaults = {
      rich_text: { type, body: "<h2>새 제목</h2><p>제품 이야기를 입력하세요.</p>" },
      full_image: { type, image: "", alt: "", caption: "" },
      image_text: { type, image: "", imagePosition: "left", heading: "", body: "<p>이미지와 함께 표시할 내용을 입력하세요.</p>" },
      gallery: { type, images: [], columns: "2" },
      highlight: { type, heading: "", body: "<p>강조할 내용을 입력하세요.</p>" },
    };
    if (!defaults[type]) return;
    product.sections.push(defaults[type]);
    setDirty(true);
    renderSections();
    const last = elements.sectionList.lastElementChild;
    last?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function uploadFiles(fileList, productId) {
    const files = [...fileList].slice(0, 30);
    const paths = [];
    if (!files.length) return paths;
    state.uploading += files.length;
    updateSaveState();
    elements.save.disabled = true;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      try {
        showToast(`이미지 업로드 중 (${index + 1}/${files.length})`);
        const prepared = await prepareImage(file);
        const data = await api("/api/admin/image", {
          method: "POST",
          headers: {
            "Content-Type": prepared.type,
            "X-Product-Id": productId,
          },
          body: prepared,
        });
        paths.push(data.path);
      } catch (error) {
        showToast(`${file.name}: ${error.message}`, true);
      } finally {
        state.uploading -= 1;
        updateSaveState();
      }
    }
    elements.save.disabled = false;
    if (paths.length) showToast(`${paths.length}장의 이미지를 추가했습니다. 마지막으로 변경사항을 저장해 주세요.`);
    return paths;
  }

  async function prepareImage(file) {
    if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있습니다.");
    if (file.size <= 2.5 * 1024 * 1024 || file.type === "image/gif") {
      if (file.size > 6 * 1024 * 1024) throw new Error("이미지는 한 장당 6MB 이하여야 합니다.");
      return file;
    }

    let bitmap;
    try { bitmap = await createImageBitmap(file); } catch (_) { throw new Error("이 이미지 형식은 브라우저에서 처리할 수 없습니다."); }
    const scale = Math.min(1, 2000 / bitmap.width, 6000 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", .86));
    if (!blob) throw new Error("이미지 용량을 줄이지 못했습니다.");
    if (blob.size > 6 * 1024 * 1024) throw new Error("압축 후에도 6MB를 넘습니다. 더 작은 이미지를 사용해 주세요.");
    return blob;
  }

  async function saveCatalog(event) {
    event.preventDefault();
    syncToastEditors();
    if (!state.dirty) {
      showToast("이미 저장된 상태입니다.");
      return;
    }
    if (state.uploading) {
      showToast("이미지 업로드가 끝날 때까지 기다려 주세요.", true);
      return;
    }
    const product = currentProduct();
    if (!product?.name.trim()) {
      showToast("제품 이름을 입력해 주세요.", true);
      $("[data-field='name']", elements.productForm).focus();
      return;
    }
    if (product.buyLink && !/^https?:\/\//i.test(product.buyLink)) {
      showToast("구매 링크는 https:// 또는 http://로 시작해야 합니다.", true);
      $("[data-field='buyLink']", elements.productForm).focus();
      return;
    }

    elements.save.disabled = true;
    elements.save.textContent = "저장 중…";
    try {
      const result = await api("/api/admin/catalog", {
        method: "PUT",
        body: JSON.stringify({ catalog: state.catalog, expectedSha: state.sha }),
      });
      state.sha = result.sha;
      setDirty(false);
      showToast("저장했습니다. 보통 1~2분 뒤 사이트에 반영됩니다.");
    } catch (error) {
      showToast(error.message, true);
      if (error.status === 409 && window.confirm("최신 내용을 다시 불러올까요? 현재 저장하지 않은 변경사항은 사라집니다.")) await openAdmin();
    } finally {
      elements.save.disabled = false;
      elements.save.textContent = "변경사항 저장";
    }
  }

  function deleteCurrentProduct() {
    const product = currentProduct();
    if (!product) return;
    if (!window.confirm(`‘${product.name || "이 제품"}’을 삭제할까요?\n저장하기 전까지는 사이트에 반영되지 않습니다.`)) return;
    const index = state.catalog.products.findIndex((item) => item.id === product.id);
    state.catalog.products.splice(index, 1);
    state.currentId = state.catalog.products[index]?.id || state.catalog.products[index - 1]?.id || "";
    setDirty(true);
    renderProductList();
    renderEditor();
    if (!state.currentId) document.body.classList.remove("editor-open");
  }

  function setDirty(value) {
    state.dirty = value;
    updateSaveState();
  }

  function updateSaveState() {
    if (state.uploading) {
      elements.saveState.textContent = `이미지 업로드 중 ${state.uploading}`;
      elements.saveState.classList.add("dirty");
    } else if (state.dirty) {
      elements.saveState.textContent = "저장하지 않은 변경사항";
      elements.saveState.classList.add("dirty");
    } else {
      elements.saveState.textContent = "저장됨";
      elements.saveState.classList.remove("dirty");
    }
  }

  function imageUrl(path) {
    const source = String(path || "");
    if (/^https?:\/\//i.test(source)) return source;
    return `/${source.replace(/^\.?\//, "")}`;
  }

  function sanitizeEditorHtml(value) {
    const allowed = new Set(["P", "BR", "H2", "H3", "H4", "STRONG", "B", "EM", "I", "S", "UL", "OL", "LI", "BLOCKQUOTE", "A", "IMG", "HR"]);
    const template = document.createElement("template");
    template.innerHTML = String(value || "");
    function clean(parent) {
      [...parent.childNodes].forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE) return node.remove();
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (!allowed.has(node.tagName)) {
          node.replaceWith(...node.childNodes);
          clean(parent);
          return;
        }
        const href = node.getAttribute("href") || "";
        const source = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
        if (node.tagName === "A" && /^https?:\/\//i.test(href)) node.setAttribute("href", href);
        if (node.tagName === "IMG") {
          if (!/^(?:https?:\/\/|(?:\.\/|\/)?images\/)/i.test(source)) {
            node.remove();
            return;
          }
          node.setAttribute("src", source);
          node.setAttribute("alt", alt);
        }
        clean(node);
      });
    }
    clean(template.content);
    return template.innerHTML;
  }

  function create(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("error", isError);
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, isError ? 6000 : 3500);
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (typeof options.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.error || "요청을 처리하지 못했습니다.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
})();
