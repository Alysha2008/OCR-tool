// Elements
const filePicker = document.getElementById("filePicker");
const plusBtn = document.getElementById("plusBtn");
const uploaderPreview = document.getElementById("uploaderPreview");
const extractBtn = document.getElementById("extractBtn");
const progressWrap = document.getElementById("progressWrap");
const progressInner = document.getElementById("progressInner");
const progressLabel = document.getElementById("progressLabel");
const chatArea = document.getElementById("chatArea");
const textInput = document.getElementById("textInput");
const modal = document.getElementById("modal");
const modalText = document.getElementById("modalText");
const modalClose = document.getElementById("modalClose");
const copyBtn = document.getElementById("copyBtn");
const modalOk = document.getElementById("modalOk");

let UPLOAD_FILES = [];
let INIT_HISTORY = window.__INIT_HISTORY || [];

// helper: render initial history entries (only those not expired)
function renderInitialHistory() {
  INIT_HISTORY.forEach(e => {
    addMsgToChat(e, false);
  });
}

// Add message card to chat
function addMsgToChat(entry, scroll=true) {
  const node = document.createElement("div");
  node.className = "msg";

  if (entry.image) {
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = entry.image;
    thumb.appendChild(img);
    node.appendChild(thumb);
  }

  const preview = document.createElement("div");
  preview.className = "preview-line";
  const one = document.createElement("span");
  one.className = "one-line";
  one.innerText = (entry.text || "").replace(/\n+/g, " ").trim().slice(0, 180);
  preview.appendChild(one);

  if ((entry.text || "").length > 180) {
    const showMore = document.createElement("button");
    showMore.className = "show-more-btn";
    showMore.innerText = "Show more";
    showMore.addEventListener("click", () => openModal(entry.text || ""));
    preview.appendChild(showMore);
  } else if ((entry.text || "").length > 0) {
    // provide copy for short text inline
    const showMore = document.createElement("button");
    showMore.className = "show-more-btn";
    showMore.innerText = "View";
    showMore.addEventListener("click", () => openModal(entry.text || ""));
    preview.appendChild(showMore);
  }

  node.appendChild(preview);

  const meta = document.createElement("div");
  meta.className = "meta";
  const elapsed = entry.elapsed_s ? `✅ Extracted in ${entry.elapsed_s}s` : "✅ Extracted";
  const when = entry.timestamp ? (` • ${entry.timestamp.split("T")[0]}`) : "";
  meta.innerText = elapsed + when;
  node.appendChild(meta);

  chatArea.prepend(node);
  if (scroll) node.scrollIntoView({behavior: "smooth", block: "center"});
}

// Modal controls
function openModal(text) {
  modalText.innerText = text;
  modal.style.display = "flex";
}
function closeModal() {
  modal.style.display = "none";
}
modalClose.addEventListener("click", closeModal);
modalOk.addEventListener("click", closeModal);
// allow clicking outside to close
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// Copy in modal (textarea fallback)
copyBtn.addEventListener("click", () => {
  const t = modalText.innerText || "";
  if (!t) return alert("Nothing to copy.");
  const ta = document.createElement("textarea");
  ta.value = t;
  document.body.appendChild(ta);
  ta.select();
  try {
    const ok = document.execCommand("copy");
    alert(ok ? "Copied to clipboard!" : "Copy failed");
  } catch (e) {
    alert("Copy failed");
  }
  document.body.removeChild(ta);
});

// file picker wiring
plusBtn.addEventListener("click", () => filePicker.click());
filePicker.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach(f => UPLOAD_FILES.push(f));
  renderUploaderPreview();
  e.target.value = "";
});

// preview thumbnails
function renderUploaderPreview() {
  uploaderPreview.innerHTML = "";
  if (!UPLOAD_FILES.length) {
    uploaderPreview.style.display = "none";
    extractBtn.style.display = "none";
    return;
  }
  uploaderPreview.style.display = "flex";
  extractBtn.style.display = "inline-block";

  UPLOAD_FILES.forEach((file, idx) => {
    const div = document.createElement("div");
    div.className = "preview";
    const img = document.createElement("img");
    const reader = new FileReader();
    reader.onload = e => img.src = e.target.result;
    reader.readAsDataURL(file);
    const rem = document.createElement("div");
    rem.className = "remove";
    rem.innerText = "x";
    rem.addEventListener("click", () => {
      UPLOAD_FILES.splice(idx, 1);
      renderUploaderPreview();
    });
    div.appendChild(img);
    div.appendChild(rem);
    uploaderPreview.appendChild(div);
  });
}

// resize helper -> returns dataURL
function resizeFileToDataURL(file, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// upload & extract (manual)
extractBtn.addEventListener("click", async () => {
  if (!UPLOAD_FILES.length) return alert("Please select images first.");
  progressWrap.style.display = "block";
  progressInner.style.width = "0%";
  progressLabel.innerText = "Extracting... 0%";

  try {
    const dataUrls = await Promise.all(UPLOAD_FILES.map(f => resizeFileToDataURL(f, 1600, 0.8)));
    const form = new FormData();
    dataUrls.forEach((durl, i) => {
      const arr = durl.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8 = new Uint8Array(n);
      while (n--) u8[n] = bstr.charCodeAt(n);
      const blob = new Blob([u8], {type: mime});
      form.append("images", blob, `img_${Date.now()}_${i}.jpg`);
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100 * 0.7); // upload weight
        progressInner.style.width = pct + "%";
        progressLabel.innerText = `Extracting... ${pct}%`;
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const res = JSON.parse(xhr.responseText);
            progressInner.style.width = "100%";
            progressLabel.innerText = "Extracting... 100%";
            (res.entries || []).forEach(ent => {
              addMsgToChat(ent, true);
            });
            UPLOAD_FILES = [];
            renderUploaderPreview();
            setTimeout(() => {
              progressWrap.style.display = "none";
              progressInner.style.width = "0%";
            }, 700);
          } catch (err) {
            alert("Server parse error");
            progressWrap.style.display = "none";
          }
        } else {
          alert("Upload failed: " + xhr.status);
          progressWrap.style.display = "none";
        }
      }
    };

    xhr.send(form);
  } catch (err) {
    alert("Error: " + err.message);
    progressWrap.style.display = "none";
  }
});

// auto-clean expired items on page load by calling server endpoint (optional)
async function clearExpired() {
  try {
    await fetch("/api/clear_expired", {method: "POST"});
  } catch (e) { /* ignore */ }
}

// initial load
(async function init() {
  await clearExpired();
  // render initial history passed from server
  renderInitialHistory();
  // focus the text input
  setTimeout(()=> textInput.focus(), 300);
})();