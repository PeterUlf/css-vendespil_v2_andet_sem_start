window.addEventListener("load", getData);
window.addEventListener("beforeprint", fitCardText);
window.addEventListener("afterprint", fitCardText);
window.addEventListener("resize", fitCardText);

const urlParams = new URLSearchParams(window.location.search);
const json = urlParams.get("json");
const spreadsheetId = "1QIzBRetFBQxjjlDb202p9Ej1qIR1PctFeWgMfPaj97A";
const cardsPerPage = 24;
const columnsPerPage = 4;
let currentPairs = [];
let currentPrintLayout = "two";
const cardImageLoads = new WeakMap();

document.querySelectorAll("[data-print-layout]").forEach((button) => {
  button.addEventListener("click", async () => {
    const buttons = document.querySelectorAll("#print-controls button");
    buttons.forEach((control) => { control.disabled = true; });
    const label = button.textContent;
    button.textContent = "Klargør billeder…";
    try {
      generatePages(currentPairs, button.dataset.printLayout);
      // Vent på både cache, billedbehandling og logoer før printdialogen åbnes.
      await waitForPageImages();
      fitCardText();
      window.print();
    } finally {
      button.textContent = label;
      buttons.forEach((control) => { control.disabled = false; });
    }
  });
});

document.querySelector("#refresh-images").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const buttons = document.querySelectorAll("#print-controls button");
  buttons.forEach((control) => { control.disabled = true; });
  const label = button.textContent;
  button.textContent = "Henter billeder…";
  try {
    const urls = currentPairs.flatMap((pair) => [pair.value_1, pair.value_2]).filter(isImageUrl);
    await refreshCardImageSources(urls);
    generatePages(currentPairs, currentPrintLayout);
    await waitForPageImages();
    fitCardText();
  } catch (error) {
    console.error("Fejl ved opdatering af billeder:", error);
    const status = document.querySelector("#status");
    status.textContent = "Billederne kunne ikke opdateres. Prøv igen.";
    status.hidden = false;
  } finally {
    button.textContent = label;
    buttons.forEach((control) => { control.disabled = false; });
  }
});

function waitForPageImages() {
  return Promise.all([...document.querySelectorAll("#pages img")].map((img) =>
    cardImageLoads.get(img) ?? img.decode().catch(() => {})
  ));
}

async function getData() {
  const status = document.querySelector("#status");

  try {
    const items = await getDataFromSheet(json ?? "0");

    if (urlParams.has("json")) {
      document.title = json;
      document.querySelector("#link").classList.add("hide");

      // Bevar navnet og kortets plads, selvom billedcellen er tom.
      const pairs = items.filter((item) => {
        if (item.value_1 && item.value_2) return true;
        const name = item.value_1 || item.value_2;
        return name && !isImageUrl(name);
      });
      currentPairs = pairs;
      generatePages(pairs);
      document.querySelector("#print-controls").hidden = pairs.length === 0;

      if (pairs.length === 0) {
        status.textContent = "Der er ingen billed- og tekstpar i dette ark.";
        status.hidden = false;
      }
    } else {
      items.forEach(generateMenu);
    }
  } catch (error) {
    console.error("Fejl ved hentning af data:", error);
    status.textContent = "Kortene kunne ikke hentes. Prøv at genindlæse siden.";
    status.hidden = false;
  }
}

async function getDataFromSheet(sheetName) {
  const params = new URLSearchParams({
    tqx: "out:json",
    tq: urlParams.has("json") ? "SELECT A, B, C" : "SELECT A, B",
    sheet: sheetName,
  });
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Regnearket svarede med ${response.status}`);
  }

  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error("Regnearket returnerede et ukendt format.");
  }

  const data = JSON.parse(match[1]);
  if (data.status === "error" || !data.table) {
    throw new Error("Regnearket kunne ikke læses.");
  }

  return data.table.rows.map((row) => ({
    value_1: String(row.c?.[0]?.v ?? "").trim(),
    value_2: String(row.c?.[1]?.v ?? "").trim(),
    group: String(row.c?.[2]?.v ?? "").trim(),
  }));
}

function generateMenu(menuItem) {
  if (!menuItem.value_1.startsWith("spil")) return;

  const clone = document.querySelector("#links").content.cloneNode(true);
  const link = clone.querySelector(".overskriften");
  link.textContent = menuItem.value_1;
  link.href = `index.html?json=${encodeURIComponent(menuItem.value_1)}`;
  clone.querySelector("a.ret").href = menuItem.value_2;
  document.querySelector("#link").appendChild(clone);
}

function generatePages(pairs, printLayout = "two") {
  currentPrintLayout = printLayout;
  const pages = document.querySelector("#pages");
  pages.replaceChildren();
  const fragment = document.createDocumentFragment();
  const groups = new Map();
  for (const pair of pairs) {
    const group = pair.group || "";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(pair);
  }

  // Sortér gruppenumrene naturligt (2 før 10). Rækker uden gruppe kommer sidst.
  const sortedGroups = [...groups].sort(([a], [b]) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b, "da", { numeric: true });
  });
  const blocks = sortedGroups.map(([group, groupPairs]) => {
    const cards = groupPairs.flatMap((pair) => {
      // Billedet står først, også når det mangler eller kolonnerne er byttet.
      const imageInSecondColumn = isImageUrl(pair.value_2) || !pair.value_2;
      const imageValue = imageInSecondColumn ? pair.value_2 : pair.value_1;
      const nameValue = imageInSecondColumn ? pair.value_1 : pair.value_2;
      if (printLayout === "two" || printLayout === "one") {
        return [{ value: imageValue, pairedValue: nameValue, overlay: true }];
      }
      return [
        { value: imageValue, pairedValue: nameValue },
        { value: nameValue, pairedValue: imageValue },
      ];
    });
    return { group, cards };
  });
  let batchNumber = 0;
  const appendSheet = (sheetBlocks, layout = null) => {
    batchNumber++;
    fragment.appendChild(createPage(sheetBlocks, false, batchNumber, layout));
    // Kun layoutet uden grupper skal have bagsider til dobbeltsidet print.
    if (printLayout === "rows") {
      fragment.appendChild(createPage(sheetBlocks, true, batchNumber, layout));
    }
  };

  if (printLayout === "rows") {
    // Fyld seks rækker på tværs af grupper uden overskrifter eller gruppemellemrum.
    const cards = blocks.flatMap((block) => block.cards);
    for (let offset = 0; offset < cards.length; offset += cardsPerPage) {
      appendSheet([{ group: "", cards: cards.slice(offset, offset + cardsPerPage) }]);
    }
    pages.appendChild(fragment);
    fitCardText();
    return;
  }

  if (printLayout === "two") {
    // Fyld hvert ark i grupperækkefølge med læsbare kort; del aldrig en gruppe.
    let sheetBlocks = [];
    for (const block of blocks) {
      const candidate = [...sheetBlocks, block];
      if (sheetBlocks.length && getGroupLayout(candidate).size < 41) {
        appendSheet(sheetBlocks, getGroupLayout(sheetBlocks));
        sheetBlocks = [];
      }
      sheetBlocks.push(block);
    }
    if (sheetBlocks.length) appendSheet(sheetBlocks, getGroupLayout(sheetBlocks));
    pages.appendChild(fragment);
    fitCardText();
    return;
  }

  for (const block of blocks) {
    appendSheet([block], getGroupLayout([block], true));
  }

  pages.appendChild(fragment);
  fitCardText();
}

function getGroupLayout(blocks, largePortraits = false) {
  const mmPerPixel = 25.4 / 96;
  const padding = 20 * mmPerPixel;
  const headingHeight = 8;
  const cardCount = blocks.reduce((sum, block) => sum + block.cards.length, 0);
  let bestLayout;
  const minimumRows = blocks.some((block) => block.cards.some((card) => card.overlay)) ? 1 : 6;

  // Enkeltgrupper afprøver alle kolonnetal for at få størst mulige billeder.
  const firstColumnCount = largePortraits ? 1 : columnsPerPage;
  const columnStep = largePortraits ? 1 : 2;
  const maxColumns = Math.max(columnsPerPage, Math.ceil(Math.sqrt(cardCount)) * 2);
  for (let columns = firstColumnCount; columns <= maxColumns; columns += columnStep) {
    const rows = Math.max(minimumRows, blocks.reduce((sum, block) => sum + Math.ceil(block.cards.length / columns), 0));
    // Meget store grupper får også mindre mellemrum, så alt kan være på A4.
    const gap = Math.min(10, 140 / Math.max(rows, columns));
    const gapMm = gap * mmPerPixel;
    const width = (190 - padding - (columns - 1) * gapMm) / columns;
    const height = (277 - padding - blocks.length * headingHeight - (rows + blocks.length - 1) * gapMm) / rows;
    const size = Math.floor(Math.min(largePortraits ? Infinity : 41, width, height) * 10) / 10;

    if (!bestLayout || size > bestLayout.size) {
      bestLayout = { columns, rows, size, gap };
    }
  }
  return bestLayout;
}

function fitCardText() {
  document.querySelectorAll(".card-front .explanation, .card-front .name-overlay").forEach(fitTextToCard);
}

function fitTextToCard(text) {
  if (text.querySelector("img")) return;

  // Bevar den store skrift, men tilpas lange tekster til det kvadratiske kort.
  text.style.removeProperty("font-size");
  const card = text.closest(".square");
  const style = getComputedStyle(card);
  const availableHeight = text.classList.contains("name-overlay")
    ? card.clientWidth * 0.45
    : card.clientWidth - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  if (text.scrollHeight <= availableHeight) return;

  let min = 1;
  let max = parseFloat(getComputedStyle(text).fontSize);
  for (let step = 0; step < 8; step++) {
    const size = (min + max) / 2;
    text.style.fontSize = `${size}px`;
    if (text.scrollHeight <= availableHeight) {
      min = size;
    } else {
      max = size;
    }
  }
  text.style.fontSize = `${Math.floor(min * 10) / 10}px`;
}

function isImageUrl(value) {
  return /^https?:\/\//i.test(value);
}

function fillCard(explanation, value, pairedValue) {
  const personName = isImageUrl(pairedValue) ? "personen" : pairedValue;
  const missingImageText = `Billede af ${personName} mangler`;

  if (!value) {
    explanation.textContent = missingImageText;
  } else if (isImageUrl(value)) {
    const img = document.createElement("img");
    img.alt = `Billede af ${personName}`;
    explanation.replaceChildren(img);
    const loaded = getCardImageSource(value).then(async (source) => {
      img.src = source;
      try {
        await img.decode();
      } catch (error) {
        if (source === value) throw error;
        img.src = value;
        await img.decode();
      }
    }).catch(() => {
      explanation.textContent = missingImageText;
      if (explanation.isConnected) fitTextToCard(explanation);
    });
    cardImageLoads.set(img, loaded);
  } else {
    explanation.textContent = value;
  }
}

function createPage(blocks, isBack, batchNumber, layout = null) {
  const section = document.createElement("section");
  section.className = `card-page grid ${isBack ? "card-back" : "card-front"}`;
  const label = layout ? blocks.map((block) => block.group ? `Gruppe ${block.group}` : "Uden gruppe").join(", ") : `Ark ${batchNumber}`;
  section.setAttribute("aria-label", `${label}, ${isBack ? "bagside" : "forside"}`);
  const columns = layout?.columns ?? columnsPerPage;
  const rows = layout?.rows ?? cardsPerPage / columnsPerPage;
  const blockRows = blocks.map((block) => Math.ceil(block.cards.length / columns));
  blockRows[blockRows.length - 1] += rows - blockRows.reduce((sum, count) => sum + count, 0);

  if (layout) {
    section.classList.add("has-group");
    section.style.setProperty("--columns", columns);
    section.style.setProperty("--rows", layout.rows);
    section.style.setProperty("--card-size", `${layout.size}mm`);
    section.style.setProperty("--card-gap", `${layout.gap}px`);
    section.style.setProperty("--group-tracks", blockRows.map((count) => `8mm repeat(${count}, var(--card-size))`).join(" "));
  }

  // Bagsidens kolonner spejles til dobbeltsidet print langs den lange kant.
  const mirrored = isBack;

  let gridRow = 1;
  blocks.forEach((block, blockIndex) => {
    if (layout) {
      const heading = document.createElement(isBack ? "div" : "h2");
      heading.className = "group-heading";
      heading.style.gridRow = gridRow++;
      if (isBack) {
        // Reservér samme plads over kortene på bagsiden til dobbeltsidet print.
        heading.setAttribute("aria-hidden", "true");
      } else {
        heading.textContent = block.group ? `Gruppe ${block.group}` : "Uden gruppe";
      }
      section.appendChild(heading);
    }

    for (let index = 0; index < blockRows[blockIndex] * columns; index++) {
      let card;
      if (index < block.cards.length) {
        const template = document.querySelector(isBack ? "#bagside" : "#forside");
        card = template.content.firstElementChild.cloneNode(true);
        if (!isBack) {
          const { value, pairedValue, overlay } = block.cards[index];
          fillCard(card.querySelector(".explanation"), value, pairedValue);
          if (overlay) {
            card.classList.add("portrait-card");
            const name = document.createElement("div");
            name.className = "name-overlay";
            name.textContent = pairedValue;
            card.appendChild(name);
          }
        }
      } else {
        // Tomme positioner spejles også, både mellem grupper og nederst på arket.
        card = document.createElement("div");
        card.className = "square empty-card";
        card.setAttribute("aria-hidden", "true");
      }

      const column = index % columns;
      card.style.gridRow = gridRow + Math.floor(index / columns);
      card.style.gridColumn = mirrored ? columns - column : column + 1;
      section.appendChild(card);
    }
    gridRow += blockRows[blockIndex];
  });

  return section;
}
