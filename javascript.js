window.addEventListener("load", getData);
console.log("fra localstorage" + localStorage.getItem("logo"));

// bruges til ...
let formattedData;
let bagsideLogo;

// Brukes til å hente URL-parameteren
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const json = urlParams.get("json");
const spreadsheetId = "1QIzBRetFBQxjjlDb202p9Ej1qIR1PctFeWgMfPaj97A";

async function getDataFromSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&tq=SELECT A, B LIMIT 20&sheet=${sheetName}`;
  console.log("url er", url);
  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonText = text.match(
      /(?<=google\.visualization\.Query\.setResponse\()(.+)(?=\);)/s
    );
    const data = JSON.parse(jsonText[0]);

    formattedData = data.table.rows.map((row) => ({
      // Her formaterer jeg data
      forside_1: row.c[0].v,
      forside_2: row.c[1].v,
    }));

    console.log(formattedData);
  } catch (error) {
    console.error("Fejl ved hentning af data:", error);
  }
}

async function getData() {
  console.log("json er", json);

  try {
    // await getSheetNames();
    await getDataFromSheet(json);
  } catch (error) {
    console.error("Fejl ved hentning af data:", error);
  }

  const pageNumbers = [1, 2];
  pageNumbers.forEach((pageNumber) => {
    formattedData.forEach((item) => {
      showCard(item, pageNumber);
    });
  });
}

function showCard(item, page) {
  if (!urlParams.has("json")) {
    //hvis der ikke er en url parameter (forsiden)

    const template = document.querySelector("#links").content;
    const clone = template.cloneNode(true);

    console.log("clone: ", clone);
    if (page === 1 && item["forside_1"].slice(0, 4) === "spil") {
      clone.querySelector(".overskriften").textContent = item["forside_1"];
      clone.querySelector("a.ret").href = item["forside_2"];
      clone.querySelector(
        "a.overskriften"
      ).href = `index.html?json=${item["forside_1"]}`;
      document.querySelector("#link").appendChild(clone);
    } else if (item["forside_1"] === "bagsidelogo") {
      localStorage.clear;
      localStorage.setItem("logo", item["forside_2"]);

      localStorage.clear;

      //clone.querySelector("img.logo").src = item["forside_2"];
      // clone.querySelector("a").href = item["forside_2"];
      // document.querySelector("#link").appendChild(clone);
    }
  } else {
    document.querySelector("#link").classList = "hide";
    console.log("her er en json", json);

    //hvis der er en json variabel i url sættes title til json variablens indhold
    document.querySelector("title").textContent = json;
    //skjuler linksectionen hvis der er json variabel

    const template = document.querySelector("#forside").content;
    const clone = template.cloneNode(true);
    clone.querySelector(".explanation").textContent = item["forside_" + page];
    document.querySelector("#side" + page).appendChild(clone);

    const template2 = document.querySelector("#bagside").content;
    const clone2 = template2.cloneNode(true);
    if (localStorage.getItem("logo") != "standard") {
      clone2.querySelector(".logo").src = localStorage.getItem("logo");
    }
    document.querySelector("#bagside" + page).appendChild(clone2);
  }
}
