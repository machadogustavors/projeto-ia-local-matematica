"use strict";

const form = document.querySelector("#chat-form");
const question = document.querySelector("#question");
const sendButton = document.querySelector("#send-button");
const newChatButton = document.querySelector("#new-chat");
const conversation = document.querySelector("#conversation");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const status = document.querySelector("#connection-status");
const modeNotice = document.querySelector("#mode-notice");
const errorMessage = document.querySelector("#error-message");
const characterCount = document.querySelector("#character-count");
const suggestionButtons = document.querySelectorAll("[data-prompt]");
const chatTab = document.querySelector("#chat-tab");
const contentsTab = document.querySelector("#contents-tab");
const contentsPanel = document.querySelector("#contents-panel");
const chatComposer = document.querySelector("#chat-composer");
const contentForm = document.querySelector("#content-form");
const contentTitle = document.querySelector("#content-title");
const contentBody = document.querySelector("#content-body");
const contentFormTitle = document.querySelector("#content-form-title");
const saveContentButton = document.querySelector("#save-content");
const cancelContentEditButton = document.querySelector("#cancel-content-edit");
const refreshContentsButton = document.querySelector("#refresh-contents");
const contentList = document.querySelector("#content-list");
const contentCount = document.querySelector("#content-count");
const contentsEmpty = document.querySelector("#contents-empty");
const contentFeedback = document.querySelector("#content-feedback");
const contentCharacterCount = document.querySelector("#content-character-count");

let history = [];
let isBusy = false;
let isReady = false;
let isDemo = false;
let editingContentId = null;
let isWritingContent = false;
let isLoadingContents = false;

async function requestJson(path, options = {}) {
  const response = await fetch(path, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Não foi possível concluir a operação.");
  }
  return data;
}

function showContentFeedback(message, isError = false) {
  contentFeedback.textContent = message;
  contentFeedback.hidden = !message;
  contentFeedback.dataset.state = isError ? "error" : "success";
}

function updateContentCounter() {
  contentCharacterCount.textContent = `${contentBody.value.length.toLocaleString("pt-BR")} / 20.000 caracteres`;
}

function resetContentForm() {
  editingContentId = null;
  contentForm.reset();
  contentFormTitle.textContent = "Adicionar conteúdo";
  saveContentButton.textContent = "Salvar conteúdo";
  cancelContentEditButton.hidden = true;
  updateContentCounter();
}

function setContentBusy(busy) {
  isWritingContent = busy;
  contentTitle.disabled = busy;
  contentBody.disabled = busy;
  cancelContentEditButton.disabled = busy;
  saveContentButton.disabled = busy || isLoadingContents;
  refreshContentsButton.disabled = busy || isLoadingContents;
  contentList.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
}

function renderContents(contents) {
  contentList.replaceChildren();
  contentCount.textContent = `(${contents.length})`;
  contentsEmpty.hidden = contents.length > 0;
  contents.forEach((content) => {
    const card = document.createElement("article");
    card.className = "content-card";
    const title = document.createElement("h4");
    title.textContent = content.title;
    const preview = document.createElement("p");
    preview.textContent = content.preview;
    const metadata = document.createElement("small");
    metadata.textContent = `${content.character_count.toLocaleString("pt-BR")} caracteres`;
    const actions = document.createElement("div");
    actions.className = "content-card-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary-button";
    edit.textContent = "Editar";
    edit.setAttribute("aria-label", `Editar ${content.title}`);
    edit.addEventListener("click", () => editContent(content.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "secondary-button danger-button";
    remove.textContent = "Excluir";
    remove.setAttribute("aria-label", `Excluir ${content.title}`);
    remove.addEventListener("click", () => deleteContent(content.id, content.title));
    actions.append(edit, remove);
    card.append(title, preview, metadata, actions);
    contentList.append(card);
  });
}

async function loadContents() {
  if (isLoadingContents) {
    return false;
  }
  isLoadingContents = true;
  refreshContentsButton.disabled = true;
  saveContentButton.disabled = true;
  contentList.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  contentsEmpty.hidden = true;
  try {
    const data = await requestJson("/api/contents");
    renderContents(data.contents);
    return true;
  } catch (error) {
    showContentFeedback(error instanceof Error ? error.message : "Não consegui carregar os conteúdos.", true);
    return false;
  } finally {
    isLoadingContents = false;
    refreshContentsButton.disabled = isWritingContent;
    saveContentButton.disabled = isWritingContent;
    contentList.querySelectorAll("button").forEach((button) => { button.disabled = isWritingContent; });
  }
}

async function editContent(id) {
  if (isWritingContent || isLoadingContents) {
    return;
  }
  if ((contentTitle.value.trim() || contentBody.value.trim()) && !confirm("Descartar o texto do formulário e abrir este conteúdo?")) {
    return;
  }
  setContentBusy(true);
  showContentFeedback("");
  try {
    const data = await requestJson(`/api/contents/${id}`);
    editingContentId = data.content.id;
    contentTitle.value = data.content.title;
    contentBody.value = data.content.body;
    contentFormTitle.textContent = "Editar conteúdo";
    saveContentButton.textContent = "Salvar alterações";
    cancelContentEditButton.hidden = false;
    updateContentCounter();
    contentForm.scrollIntoView({ block: "nearest" });
  } catch (error) {
    showContentFeedback(error instanceof Error ? error.message : "Não consegui abrir o conteúdo.", true);
  } finally {
    setContentBusy(false);
    contentTitle.focus();
  }
}

async function deleteContent(id, title) {
  if (isWritingContent || isLoadingContents || !confirm(`Excluir o conteúdo “${title}”? Ele deixará de ser consultado nas próximas perguntas.`)) {
    return;
  }
  setContentBusy(true);
  showContentFeedback("");
  try {
    await requestJson(`/api/contents/${id}`, { method: "DELETE" });
    if (editingContentId === id) {
      resetContentForm();
    }
    if (await loadContents()) {
      showContentFeedback("Conteúdo excluído. As próximas perguntas não usarão esse material como referência.");
    }
  } catch (error) {
    showContentFeedback(error instanceof Error ? error.message : "Não consegui excluir o conteúdo.", true);
  } finally {
    setContentBusy(false);
  }
}

async function switchView(showContents) {
  chatTab.setAttribute("aria-selected", String(!showContents));
  contentsTab.setAttribute("aria-selected", String(showContents));
  chatTab.tabIndex = showContents ? -1 : 0;
  contentsTab.tabIndex = showContents ? 0 : -1;
  conversation.hidden = showContents;
  chatComposer.hidden = showContents;
  contentsPanel.hidden = !showContents;
  if (showContents) {
    if (!isWritingContent) {
      showContentFeedback("");
      await loadContents();
    }
  } else {
    updateInput();
    scrollConversation();
  }
}

function addReplyReferences(article, data) {
  const note = document.createElement("div");
  note.className = "reply-reference";
  if (data.source === "demo") {
    note.textContent = data.references.length
      ? "Demonstração: os materiais abaixo seriam enviados ao modelo. Esta resposta é fixa."
      : "Demonstração: nenhum trecho relacionado foi encontrado. Esta resposta é fixa.";
  } else if (data.source === "materials") {
    note.textContent = "Materiais enviados como referência. O modelo também pode usar conhecimento próprio; confira a resposta.";
  } else {
    note.textContent = "Resposta baseada no conhecimento do modelo, sem referência cadastrada encontrada.";
  }
  article.append(note);
  data.references.forEach((reference) => {
    const details = document.createElement("details");
    details.className = "reference-detail";
    const summary = document.createElement("summary");
    summary.textContent = reference.title;
    const excerpt = document.createElement("p");
    excerpt.textContent = reference.excerpt;
    details.append(summary, excerpt);
    article.append(details);
  });
  scrollConversation();
}

function updateInput() {
  characterCount.textContent = `${question.value.length} / 1500`;
  question.style.height = "auto";
  question.style.height = `${Math.min(question.scrollHeight, 140)}px`;
  sendButton.disabled = isBusy || !isReady || !question.value.trim();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function scrollConversation() {
  conversation.scrollTop = conversation.scrollHeight;
}

function addMessage(role, content, pending = false) {
  const article = document.createElement("article");
  article.className = `message ${role}${pending ? " pending" : ""}`;
  const label = document.createElement("span");
  label.className = "message-label";
  label.textContent = role === "user" ? "VOCÊ" : isDemo ? "TUTOR · DEMONSTRAÇÃO" : "CONTA COMIGO";
  const text = document.createElement("p");
  text.textContent = content;
  article.append(label, text);
  messages.append(article);
  scrollConversation();
  return article;
}

async function checkStatus() {
  try {
    if (location.protocol === "file:") {
      throw new Error("Abra pelo servidor local: execute python server.py e acesse http://127.0.0.1:8000.");
    }
    const data = await requestJson("/api/status");
    isReady = true;
    isDemo = data.demo;
    status.dataset.state = isDemo ? "demo" : "ready";
    status.textContent = isDemo ? "Demonstração" : "Modelo local pronto";
    modeNotice.hidden = !isDemo;
    modeNotice.textContent = "Modo demonstração: respostas fixas para testar a interface. Nenhum modelo de IA está sendo usado.";
    showError("");
  } catch (error) {
    isReady = false;
    status.dataset.state = "error";
    status.textContent = "Modelo indisponível";
    showError(error instanceof Error ? error.message : "Não foi possível conectar ao servidor local.");
  }
  updateInput();
}

async function submitQuestion(event) {
  event.preventDefault();
  const content = question.value.trim();
  if (!content || isBusy) {
    return;
  }
  if (!isReady) {
    await checkStatus();
    if (!isReady) {
      return;
    }
  }

  isBusy = true;
  question.disabled = true;
  newChatButton.disabled = true;
  suggestionButtons.forEach((button) => { button.disabled = true; });
  showError("");
  welcome.hidden = true;
  const userMessage = addMessage("user", content);
  const pendingMessage = addMessage("assistant", "Pensando com calma… Na Raspberry, isso pode levar um tempinho.", true);
  question.value = "";
  updateInput();

  try {
    const data = await requestJson("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...history, { role: "user", content }].slice(-11) }),
    });
    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("O modelo retornou uma resposta vazia. Tente novamente.");
    }
    pendingMessage.remove();
    const reply = addMessage("assistant", data.reply);
    addReplyReferences(reply, data);
    history = [...history, { role: "user", content }, { role: "assistant", content: data.reply }].slice(-10);
  } catch (error) {
    pendingMessage.remove();
    userMessage.remove();
    question.value = content;
    showError(error instanceof Error ? error.message : "Falha na conexão. Sua pergunta foi preservada para tentar novamente.");
  } finally {
    isBusy = false;
    question.disabled = false;
    newChatButton.disabled = false;
    suggestionButtons.forEach((button) => { button.disabled = false; });
    updateInput();
    question.focus();
  }
}

form.addEventListener("submit", submitQuestion);
question.addEventListener("input", updateInput);
question.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!isBusy) {
      form.requestSubmit();
    }
  }
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    question.value = button.dataset.prompt;
    updateInput();
    question.focus();
  });
});

newChatButton.addEventListener("click", () => {
  if (isBusy || (history.length > 0 && !confirm("Começar uma nova conversa? A conversa atual será apagada desta tela."))) {
    return;
  }
  history = [];
  messages.replaceChildren();
  welcome.hidden = false;
  question.value = "";
  showError("");
  switchView(false);
  updateInput();
  question.focus();
});

chatTab.addEventListener("click", () => switchView(false));
contentsTab.addEventListener("click", () => switchView(true));

[chatTab, contentsTab].forEach((tab) => {
  tab.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const showContents = event.key === "End"
        || (event.key !== "Home" && tab === chatTab);
      (showContents ? contentsTab : chatTab).focus();
      switchView(showContents);
    }
  });
});

contentBody.addEventListener("input", updateContentCounter);
cancelContentEditButton.addEventListener("click", () => {
  if (!confirm("Cancelar a edição e descartar as alterações não salvas?")) {
    return;
  }
  resetContentForm();
  showContentFeedback("");
});
refreshContentsButton.addEventListener("click", () => {
  showContentFeedback("");
  loadContents();
});

contentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isWritingContent || isLoadingContents) {
    return;
  }
  const title = contentTitle.value.trim();
  const body = contentBody.value.trim();
  if (!title || !body) {
    showContentFeedback("Preencha o título e o texto do conteúdo.", true);
    return;
  }
  setContentBusy(true);
  showContentFeedback("");
  try {
    const path = editingContentId === null ? "/api/contents" : `/api/contents/${editingContentId}`;
    await requestJson(path, {
      method: editingContentId === null ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    resetContentForm();
    if (await loadContents()) {
      showContentFeedback("Conteúdo salvo nesta máquina! Já pode ser consultado nas próximas perguntas.");
    }
  } catch (error) {
    showContentFeedback(error instanceof Error ? error.message : "Não consegui salvar. Seu texto foi preservado.", true);
  } finally {
    setContentBusy(false);
  }
});

checkStatus();
