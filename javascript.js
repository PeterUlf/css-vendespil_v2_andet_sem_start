window.addEventListener("load", getData);

// bruges til ...
let formattedData; //indeholder data
let formattedDataFirstSheet; //indeholder data

let bagsideLogo;

// Brukes til å hente URL-parameteren
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const json = urlParams.get("json");
const spreadsheetId = "1QIzBRetFBQxjjlDb202p9Ej1qIR1PctFeWgMfPaj97A";

async function getData() {
  //console.log("json er", json);

  try {
    // await getSheetNames();
    await getDataFromSheet(json);
    await getDataFromFirstSheet("0");
  } catch (error) {
    console.error("Fejl ved hentning af data:", error);
  }

  const pageNumbers = [1, 2];

  if (urlParams.has("json")) {
    pageNumbers.forEach((pageNumber) => {
      formattedData.forEach((item) => {
        showCard(item, pageNumber);
      });
    });

    generateback();
    //find bagsideLogo
  } else {
    formattedDataFirstSheet.forEach((menuItem) => {
      generateMenu(menuItem);
    });
  }
}

function bagsideLogoet() {
  console.log("bagsideLogoet");
  let bagsidelogoObj = formattedDataFirstSheet.find(
    (o) => o.value_1 === "bagsidelogo"
  );

  if (bagsidelogoObj.value_2) {
    return bagsidelogoObj.value_2;
  } else {
    return "./img/logo.jpg";
  }
}

async function getDataFromFirstSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&tq=SELECT A, B LIMIT 20&sheet=${sheetName}`;
  //console.log("url er", url);
  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonText = text.match(
      /(?<=google\.visualization\.Query\.setResponse\()(.+)(?=\);)/s
    );
    const data = JSON.parse(jsonText[0]);

    formattedDataFirstSheet = data.table.rows.map((row) => ({
      // Her formaterer jeg data
      value_1: row.c[0].v,
      value_2: row.c[1].v,
    }));

    //console.log("formattedDataFirstSheet ,", formattedDataFirstSheet);
  } catch (error) {
    console.error("Fejl ved hentning af data:", error);
  }
}

async function getDataFromSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&tq=SELECT A, B LIMIT 20&sheet=${sheetName}`;
  // console.log("url er", url);
  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonText = text.match(
      /(?<=google\.visualization\.Query\.setResponse\()(.+)(?=\);)/s
    );
    const data = JSON.parse(jsonText[0]);

    formattedData = data.table.rows.map((row) => ({
      // Her formaterer jeg data
      value_1: row.c[0].v,
      value_2: row.c[1].v,
    }));

    // console.log(formattedData);
  } catch (error) {
    console.error("Fejl ved hentning af data:", error);
  }
}

function generateMenu(menuItem) {
  //console.log("generateMenu");
  if (!urlParams.has("json")) {
    //hvis der ikke er en url parameter (forsiden)

    const template = document.querySelector("#links").content;
    const clone = template.cloneNode(true);

    if (menuItem["value_1"].slice(0, 4) === "spil") {
      console.log("spil: ", clone);
      clone.querySelector(".overskriften").textContent = menuItem["value_1"];
      clone.querySelector("a.ret").href = menuItem["value_2"];
      clone.querySelector(
        "a.overskriften"
      ).href = `index.html?json=${menuItem["value_1"]}`;
      document.querySelector("#link").appendChild(clone);
    }
  }
}

function showCard(item, page) {
  document.querySelector("#link").classList = "hide";
  console.log("her er en json", json);

  //hvis der er en json variabel i url sættes title til json variablens indhold
  document.querySelector("title").textContent = json;
  //skjuler linksectionen hvis der er json variabel

  const template = document.querySelector("#forside").content;
  const clone = template.cloneNode(true);
  //
  if (item["value_" + page].slice(0, 4) === "http") {
    //hvis det starter med http er det nok et billede og skal sættes ind som sådan
    clone.querySelector(".explanation").innerHTML = `<img src="${
      item["value_" + page]
    }">`;
  } else {
    clone.querySelector(".explanation").textContent = item["value_" + page];
  }

  document.querySelector("#side" + page).appendChild(clone);

  // const template2 = document.querySelector("#bagside").content;
  // const clone2 = template2.cloneNode(true);

  // clone2.querySelector(".logo").src = bagsideLogoet();

  // document.querySelector("#bagside" + page).appendChild(clone2);
}

function generateback() {
  console.log("generateback");
  for (let i = 1; i <= 20; i++) {
    const template = document.querySelector("#bagside").content;
    const clone = template.cloneNode(true);
    clone.querySelector(".logo").src = bagsideLogoet();
    document.querySelector("#bagside1").appendChild(clone);
  }
  for (let i = 1; i <= 20; i++) {
    const template = document.querySelector("#bagside").content;
    const clone = template.cloneNode(true);
    clone.querySelector(".logo").src = bagsideLogoet();
    document.querySelector("#bagside2").appendChild(clone);
  }
}
