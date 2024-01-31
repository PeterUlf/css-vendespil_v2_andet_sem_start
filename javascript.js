let formattedData;

async function getData() {
  const spreadsheetId = "1QIzBRetFBQxjjlDb202p9Ej1qIR1PctFeWgMfPaj97A";
  const sheetName = "datatyper";
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&tq=SELECT A, B LIMIT 20`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonText = text.match(
      /(?<=google\.visualization\.Query\.setResponse\()(.+)(?=\);)/s
    );
    const data = JSON.parse(jsonText[0]);

    formattedData = data.table.rows.map((row) => ({
      //her formaterer jeg data
      forside_1: row.c[0].v,
      forside_2: row.c[1].v,
    }));

    console.log(formattedData);
  } catch (error) {
    console.error("Fejl ved hentning af data:", error);
  }

  //   document.querySelector("title").textContent = json;
  const pageNumbers = [1, 2];
  let pageNumber;

  console.log(formattedData);

  pageNumbers.forEach((pageNumber) => {
    //looper igennem tallene 1-4 fra const page
    console.log("pageNumber is " + pageNumber);

    formattedData.forEach((item) => {
      showCard(item, pageNumber);
    }); //looper igennem data, først med 1 som var derefeter
  });
}

window.addEventListener("load", getData);

//bruges til at hente url parameter
// const queryString = window.location.search;
// const urlParams = new URLSearchParams(queryString);
// const json = urlParams.get("json");

// if (!urlParams.has("json")) {
//   document.querySelector("body").innerHTML =
//     "<a href='./index.html?json=datatyper.json'><h1>Hent datatypespil</h1></a> ";
// }

// async function getData() {
//   document.querySelector("title").textContent = json;
//   const response = await fetch(json);
//   const data = await response.json();
//   const pageNumbers = [1, 2];
//   let pageNumber;
//   console.log(data);

//   pageNumbers.forEach((pageNumber) => {
//     //looper igennem tallene 1-4 fra const page
//     console.log("pageNumber is " + pageNumber);

//     data.forEach((item) => {
//       showCard(item, pageNumber);
//     }); //looper igennem data, først med 1 som var derefeter
//   });
// }

function showCard(item, page) {
  console.log("showCard");
  const template = document.querySelector("#forside").content;
  const clone = template.cloneNode(true);
  console.log("page er ", page);
  clone.querySelector(".explanation").textContent = item["forside_" + page];
  document.querySelector("#side" + page).appendChild(clone);

  const template2 = document.querySelector("#bagside").content;
  const clone2 = template2.cloneNode(true);
  document.querySelector("#bagside" + page).appendChild(clone2);
}
