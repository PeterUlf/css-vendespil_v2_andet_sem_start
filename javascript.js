window.addEventListener("load", getData);

//bruges til at hente url parameter
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const json = urlParams.get("json");

async function getData() {
  const response = await fetch(json);
  const data = await response.json();
  const pageNumbers = [1, 2];
  let pageNumber;
  console.log(data);

  pageNumbers.forEach((pageNumber) => {
    //looper igennem tallene 1-4 fra const page
    console.log("pageNumber is " + pageNumber);

    data.forEach((item) => {
      showCard(item, pageNumber);
    }); //looper igennem data, først med 1 som var derefeter
  });
}

function showCard(item, page) {
  console.log("showCard");
  const template = document.querySelector("#forside").content;
  const clone = template.cloneNode(true);
  console.log("page er ", page);
  clone.querySelector(".explanation").textContent = item.forside_1;
  document.querySelector("#side" + page).appendChild(clone);

  const template2 = document.querySelector("#bagside").content;
  const clone2 = template2.cloneNode(true);
  document.querySelector("#bagside" + page).appendChild(clone2);
}
