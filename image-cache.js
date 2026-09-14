// 600 px giver cirka 350 dpi på de største kort (43 mm).
const cardImageMaxSize = 600;
const cardImageCacheName = "vendespil-card-images-v1-600";
const cardImageCacheMaxAge = 7 * 24 * 60 * 60 * 1000;
const cardImageSources = new Map();
const cardImageQueue = [];
let activeCardImages = 0;
let cardImageCachePromise;

function openCardImageCache() {
  if (!cardImageCachePromise) {
    cardImageCachePromise = (async () => {
      const cache = await caches.open(cardImageCacheName);
      // Fjern også udløbne billeder fra spil, der ikke længere bliver åbnet.
      const keys = await cache.keys();
      await Promise.all(keys.map(async (key) => {
        const entry = await cache.match(key);
        if (!isFreshCardImage(entry)) await cache.delete(key);
      }));
      return cache;
    })().catch(() => null);
  }
  return cardImageCachePromise;
}

function isFreshCardImage(response) {
  const savedAt = Number(response?.headers.get("X-Vendespil-Saved-At"));
  return savedAt > 0 && Date.now() - savedAt < cardImageCacheMaxAge;
}

function getCardImageSource(url, refresh = false) {
  if (refresh || !cardImageSources.has(url)) {
    // Genbrug samme resultat ved layoutskift og gentagne billedlinks.
    cardImageSources.set(url, new Promise((resolve) => {
      cardImageQueue.push({ url, resolve, refresh });
      processCardImageQueue();
    }));
  }
  return cardImageSources.get(url);
}

async function refreshCardImageSources(urls) {
  const uniqueUrls = [...new Set(urls)];
  // Lad igangværende hentninger afslutte, så de ikke overskriver de nye kopier.
  const oldSources = await Promise.all(uniqueUrls.map((url) => cardImageSources.get(url)));
  const cache = await openCardImageCache();
  if (cache) {
    await Promise.all(uniqueUrls.map((url) => cache.delete(url).catch(() => {})));
  }
  await Promise.all(uniqueUrls.map((url) => getCardImageSource(url, true)));
  oldSources.forEach((source) => {
    if (source?.startsWith("blob:")) URL.revokeObjectURL(source);
  });
}

function processCardImageQueue() {
  // Begræns antallet af store originalbilleder, der behandles samtidigt.
  while (activeCardImages < 4 && cardImageQueue.length) {
    const { url, resolve, refresh } = cardImageQueue.shift();
    let downloadUrl = url;
    if (refresh) {
      // Også billeder uden CORS-tilladelse skal hentes på ny ved refresh.
      const freshUrl = new URL(url);
      freshUrl.searchParams.set("_vendespil_refresh", String(Date.now()));
      downloadUrl = freshUrl.href;
    }
    activeCardImages++;
    prepareCardImage(url, downloadUrl, refresh).catch(() => downloadUrl).then(resolve).finally(() => {
      activeCardImages--;
      processCardImageQueue();
    });
  }
}

async function prepareCardImage(url, downloadUrl = url, refresh = false) {
  const cache = await openCardImageCache();
  if (cache && !refresh) {
    try {
      const cached = await cache.match(url);
      if (isFreshCardImage(cached)) {
        return URL.createObjectURL(await cached.blob());
      }
    } catch {
      // Billeder skal stadig virke, hvis browserens lager er utilgængeligt.
    }
  }

  // Gem kun den bearbejdede kopi i vores cache, ikke originalens download.
  // Ved CORS-fejl falder køen tilbage til det almindelige billedlink.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let original;
  try {
    const response = await fetch(downloadUrl, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Billedserveren svarede med ${response.status}`);
    original = await response.blob();
  } finally {
    clearTimeout(timeout);
  }

  const blob = await resizeCardImage(original);
  if (cache) {
    try {
      await cache.put(url, new Response(blob, {
        headers: {
          "Content-Type": blob.type,
          "X-Vendespil-Saved-At": String(Date.now()),
        },
      }));
    } catch {
      // Brug den lille kopi resten af besøget, selv hvis lageret er fuldt.
    }
  }
  // Disse URL'er genbruges ved print og frigives af browseren ved sideskift.
  return URL.createObjectURL(blob);
}

async function resizeCardImage(original) {
  const source = URL.createObjectURL(original);
  const img = new Image();
  try {
    img.src = source;
    await img.decode();
    const scale = Math.min(1, cardImageMaxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const resized = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!resized) throw new Error("Billedet kunne ikke formindskes.");
    // Små filer skal hverken opskaleres eller fylde mere efter komprimering.
    return scale === 1 && original.size <= resized.size ? original : resized;
  } finally {
    URL.revokeObjectURL(source);
  }
}
