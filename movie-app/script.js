// async function mainSearch() {
//     const query = document.getElementById("movieInput").value.trim();
//     const resultsList = document.getElementById("resultsList");

//     if (!query) return;

//     resultsList.innerHTML = "Searching...";

//     const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
//     const movies = await res.json();

//     resultsList.innerHTML = "";

//     movies.forEach(movie => {

//         const card = document.createElement("div");

//         card.innerHTML = `
//             <img src="${movie.poster || 'https://via.placeholder.com/200x300'}">
//             <h3>${movie.name}</h3>
//             <p>${movie.year}</p>
//             <button onclick="loadSources(${movie.id}, this)">Show Platforms</button>
//             <div id="links-${movie.id}"></div>
//             <hr>
//         `;

//         resultsList.appendChild(card);
//     });
// }


// async function loadSources(id, btn) {
//     btn.textContent = "Loading...";

//     const res = await fetch(`/api/sources/${id}`);
//     const sources = await res.json();

//     const div = document.getElementById(`links-${id}`);

//     if (!sources.length) {
//         div.innerHTML = "Not available in this region.";
//         return;
//     }

//     div.innerHTML = sources.map(s =>
//         `<a href="${s.web_url}" target="_blank">
//             ${s.name} (${s.type})
//          </a><br>`
//     ).join("");

//     btn.remove();
// }