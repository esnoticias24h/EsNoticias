/* ==========================================================
   EsNoticias — motor de contenido
   Lee los archivos .md de la carpeta /noticias de GitHub
   y genera la portada, las secciones y cada noticia.
   ========================================================== */

const ESN_OWNER = "esnoticias24h";
const ESN_REPO = "EsNoticias";
const ESN_BRANCH = "main";
const ESN_API = `https://api.github.com/repos/${ESN_OWNER}/${ESN_REPO}/contents/noticias?ref=${ESN_BRANCH}`;

// --- Utilidades ---------------------------------------------------

function esnEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// Conversor muy sencillo de Markdown a HTML (párrafos, negrita, cursiva, enlaces)
function esnMarkdownToHtml(md) {
  if (!md) return "";
  const paragraphs = md.trim().split(/\n\s*\n/);
  return paragraphs
    .map(p => {
      let html = esnEscapeHtml(p.trim());
      html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

      // Guardamos los enlaces para que no se pisen entre sí al procesarlos
      const enlaces = [];

      // Formato [texto](url)
      html = html.replace(/\[(.+?)\]\((.+?)\)/g, (m, texto, url) => {
        enlaces.push(`<a href="${url}" target="_blank" rel="noopener">${texto}</a>`);
        return `%%ESNLINK${enlaces.length - 1}%%`;
      });

      // Formato <https://...>
      html = html.replace(/&lt;(https?:\/\/[^\s&]+?)&gt;/g, (m, url) => {
        enlaces.push(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
        return `%%ESNLINK${enlaces.length - 1}%%`;
      });

      // URL suelta, sin marcar de ninguna forma
      html = html.replace(/(https?:\/\/[^\s<]+)/g, (m, url) => {
        enlaces.push(`<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
        return `%%ESNLINK${enlaces.length - 1}%%`;
      });

      // Restauramos los enlaces ya construidos
      html = html.replace(/%%ESNLINK(\d+)%%/g, (m, i) => enlaces[i]);

      html = html.replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    })
    .join("\n");
}
}

// Parser de "front matter" YAML (líneas entre --- ... ---).
// Soporta valores simples y listas (formato bloque "- item" o formato en línea ["a","b"]),
// para permitir campos como "categorias" con varias opciones marcadas.
function esnParseFrontMatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const [, yaml, body] = match;
  const lines = yaml.split("\n");
  const data = {};
  let i = 0;

  function cleanScalar(value) {
    value = value.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    let value = m[2].trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      // Lista en línea: ["Nacional", "Sucesos"]
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map(v => cleanScalar(v))
        .filter(v => v.length > 0);
      i++;
      continue;
    }

    if (value === "") {
      // Puede ser una lista en formato bloque en las líneas siguientes
      const listItems = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        listItems.push(cleanScalar(lines[j].replace(/^\s*-\s+/, "")));
        j++;
      }
      if (listItems.length > 0) {
        data[key] = listItems;
        i = j;
        continue;
      }
    }

    data[key] = cleanScalar(value);
    i++;
  }

  return { data, body: body.trim() };
}

function esnSlugFromFilename(filename) {
  return filename.replace(/\.md$/, "");
}

function esnFormatFecha(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

const ESN_CAT_COLOR = {
  "Actualidad": "gray",
  "Nacional": "red",
  "Europa": "blue",
  "Palestina": "amber",
  "Sáhara Occidental": "amber",
  "Ucrania": "blue",
  "América": "blue",
  "Asia": "blue",
  "Oriente Medio": "amber",
  "Política": "red",
  "Economía": "amber",
  "Sociedad": "gray",
  "Sucesos": "red",
  "Cultura": "blue",
  "Deportes": "gray",
  "Tecnología": "gray",
  "Ciencia": "blue",
  "Salud": "amber",
  "Opinión": "amber",
  "Otros": "gray"
};

// --- Carga de datos -------------------------------------------------

async function esnCargarNoticias() {
  const listResp = await fetch(ESN_API, { headers: { Accept: "application/vnd.github.v3+json" } });
  if (!listResp.ok) {
    if (listResp.status === 404) return []; // carpeta "noticias" aún no existe
    throw new Error("No se pudo obtener la lista de noticias (" + listResp.status + ")");
  }
  const files = (await listResp.json()).filter(f => f.name.endsWith(".md"));

  const noticias = await Promise.all(
    files.map(async file => {
      const raw = await (await fetch(file.download_url)).text();
      const { data, body } = esnParseFrontMatter(raw);

      // "categorias" (nuevo, varias) tiene prioridad; si no existe, se usa
      // "categoria" (antiguo, una sola) para no romper noticias ya publicadas.
      let categorias = data.categorias;
      if (!categorias) {
        categorias = data.categoria ? [data.categoria] : ["Nacional"];
      } else if (!Array.isArray(categorias)) {
        categorias = [categorias];
      }

      return {
        slug: esnSlugFromFilename(file.name),
        title: data.title || "(Sin título)",
        categorias: categorias,
        categoria: categorias[0], // categoría principal, para color/insignia
        date: data.date || "",
        autor: data.autor || "Redacción EsNoticias",
        imagen: data.imagen || "",
        resumen: data.resumen || "",
        bodyHtml: esnMarkdownToHtml(body)
      };
    })
  );

  noticias.sort((a, b) => new Date(b.date) - new Date(a.date));
  return noticias;
}

// --- Plantillas de tarjetas ------------------------------------------

function esnCardHtml(n, variant) {
  const color = ESN_CAT_COLOR[n.categoria] || "red";
  const img = n.imagen
    ? `<img src="${esnEscapeHtml(n.imagen)}" alt="">`
    : "";
  const extraCats = n.categorias.slice(1);
  const extraCatsHtml = extraCats.length
    ? ` <span style="color:var(--slate);font-weight:400;">+ ${extraCats.map(esnEscapeHtml).join(", ")}</span>`
    : "";

  if (variant === "lead") {
    return `
      <article class="lead">
        <a href="noticia.html?n=${encodeURIComponent(n.slug)}" style="display:block;">
          <div class="lead-img">${img}<span class="badge">${esnEscapeHtml(n.categoria)}</span></div>
          <div class="cat-bar"><span class="eyebrow" style="color:var(--red);">${esnEscapeHtml(n.categoria)}${extraCatsHtml}</span>
          <h1>${esnEscapeHtml(n.title)}</h1></div>
          <p class="dek">${esnEscapeHtml(n.resumen)}</p>
          <div class="byline"><span>${esnEscapeHtml(n.autor)}</span><span class="dot"></span><span>${esnFormatFecha(n.date)}</span></div>
        </a>
      </article>`;
  }
  if (variant === "side") {
    return `
      <div class="side-card">
        <a href="noticia.html?n=${encodeURIComponent(n.slug)}">
          <div class="cat-bar ${color}"><span class="eyebrow" style="color:var(--${color});">${esnEscapeHtml(n.categoria)}${extraCatsHtml}</span>
          <h3>${esnEscapeHtml(n.title)}</h3></div>
          <p class="dek-sm">${esnEscapeHtml(n.resumen)}</p>
        </a>
      </div>`;
  }
  // grid
  return `
    <article class="story-card">
      <a href="noticia.html?n=${encodeURIComponent(n.slug)}">
        <div class="thumb">${img}</div>
        <h3>${esnEscapeHtml(n.title)}</h3>
        <p class="dek-sm">${esnEscapeHtml(n.resumen)}</p>
        <div class="byline">${esnEscapeHtml(n.categoria)}${extraCatsHtml} · ${esnFormatFecha(n.date)}</div>
      </a>
    </article>`;
}

// --- Render: Portada ---------------------------------------------------

async function esnRenderPortada() {
  const cont = document.getElementById("esn-portada");
  if (!cont) return;
  try {
    const noticias = await esnCargarNoticias();
    if (noticias.length === 0) {
      cont.innerHTML = `<p style="padding:40px 0;color:var(--slate);">Todavía no hay noticias publicadas. Publica la primera desde <a href="/admin/">el panel de administración</a>.</p>`;
      return;
    }
    const [primera, ...resto] = noticias;
    const laterales = resto.slice(0, 3);
    const gridNacional = noticias.filter(n => n.categorias.includes("Nacional")).slice(0, 3);
    const gridInternacional = noticias.filter(n => n.categorias.includes("Internacional")).slice(0, 3);

    let html = `<section class="hero">`;
    html += esnCardHtml(primera, "lead");
    html += `<aside class="side-stack">`;
    laterales.forEach(n => (html += esnCardHtml(n, "side")));
    html += `</aside></section>`;

    if (gridNacional.length) {
      html += `<section class="section-block"><div class="section-head"><h2 style="border-left:4px solid var(--red); padding-left:12px;">Nacional</h2>
        <a href="seccion.html?cat=Nacional" class="see-all">Ver todo →</a></div><div class="card-grid">`;
      gridNacional.forEach(n => (html += esnCardHtml(n, "grid")));
      html += `</div></section>`;
    }
    if (gridInternacional.length) {
      html += `<section class="section-block"><div class="section-head"><h2 style="border-left:4px solid var(--blue); padding-left:12px;">Internacional</h2>
        <a href="seccion.html?cat=Internacional" class="see-all">Ver todo →</a></div><div class="card-grid">`;
      gridInternacional.forEach(n => (html += esnCardHtml(n, "grid")));
      html += `</div></section>`;
    }

    cont.innerHTML = html;
  } catch (err) {
    cont.innerHTML = `<p style="padding:40px 0;color:var(--red);">No se han podido cargar las noticias (${esnEscapeHtml(err.message)}).</p>`;
  }
}

// --- Render: Sección (listado por categoría) ----------------------------

async function esnRenderSeccion() {
  const cont = document.getElementById("esn-seccion");
  if (!cont) return;
  const params = new URLSearchParams(window.location.search);
  const cat = params.get("cat") || "Nacional";
  document.title = `${cat} — EsNoticias`;
  const titulo = document.getElementById("esn-seccion-titulo");
  if (titulo) titulo.textContent = cat;

  try {
    const noticias = (await esnCargarNoticias()).filter(n => n.categorias.includes(cat));
    if (noticias.length === 0) {
      cont.innerHTML = `<p style="padding:40px 0;color:var(--slate);">Todavía no hay noticias en esta sección.</p>`;
      return;
    }
    cont.innerHTML = `<div class="card-grid">${noticias.map(n => esnCardHtml(n, "grid")).join("")}</div>`;
  } catch (err) {
    cont.innerHTML = `<p style="padding:40px 0;color:var(--red);">No se han podido cargar las noticias (${esnEscapeHtml(err.message)}).</p>`;
  }
}

// --- Render: Noticia individual ------------------------------------------

async function esnRenderNoticia() {
  const cont = document.getElementById("esn-noticia");
  if (!cont) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("n");

  try {
    const noticias = await esnCargarNoticias();
    const n = noticias.find(x => x.slug === slug);
    if (!n) {
      cont.innerHTML = `<p style="padding:40px 0;color:var(--red);">No se ha encontrado esta noticia.</p>`;
      return;
    }
    document.title = `${n.title} — EsNoticias`;
    const img = n.imagen ? `<div class="lead-img"><img src="${esnEscapeHtml(n.imagen)}" alt=""></div>` : "";
    const catsHtml = n.categorias.map(esnEscapeHtml).join(" · ");
    cont.innerHTML = `
      <article style="max-width:760px;margin:0 auto;padding:40px 20px;">
        <span class="eyebrow" style="color:var(--red);">${catsHtml}</span>
        <h1 style="font-size:34px;margin:10px 0 14px;">${esnEscapeHtml(n.title)}</h1>
        <div class="byline" style="margin-bottom:20px;"><span>${esnEscapeHtml(n.autor)}</span><span class="dot"></span><span>${esnFormatFecha(n.date)}</span></div>
        ${img}
        <div style="font-size:17px;line-height:1.7;margin-top:20px;text-align:justify;hyphens:auto;">${n.bodyHtml}</div>
      </article>`;
  } catch (err) {
    cont.innerHTML = `<p style="padding:40px 0;color:var(--red);">No se han podido cargar las noticias (${esnEscapeHtml(err.message)}).</p>`;
  }
}
