let currentPage = 0; // Start with the first page
let itemsPerPage = 10; // Number of results per page

function loadGalaxies() {
    // Calculate the OFFSET based on the current page
    const offset = currentPage * itemsPerPage;

    if(currentPage == 0) {
        document.getElementById("prevBtn").disabled = true
    } else {
        document.getElementById("prevBtn").disabled = false
    }

    // SPARQL query with LIMIT and OFFSET for pagination
    let req = `
    SELECT * WHERE {
        ?x a dbo:Galaxy.
        ?x a dbo:CelestialBody.
        ?x rdfs:label ?name.
        ?x dbo:thumbnail ?imgUrl.
        FILTER(lang(?name) = 'en') 
    }
    LIMIT ${itemsPerPage}
    OFFSET ${offset}
    `;

    executeRequest(req, function (state, data) {
        if (state) {
            const resultsSection = document.getElementById("results");
            resultsSection.innerHTML = ""; // Clear previous results

            data.results.bindings.forEach(element => {
                resultsSection.innerHTML += `
                <div class="card">
                    <div class="card-image">
                        <img src="${element.imgUrl.value}" alt="Card Image">
                    </div>
                    <div class="card-content">
                        <h2>${element.name.value}</h2>
                    </div>
                </div>
                `;
            });

            // Update current page display
            document.getElementById("currentPage").innerText = `Page: ${currentPage + 1}`
        } else {
            console.error("Failed to fetch data.");
        }
    });
}


function updateItemsPerPage(value) {
    itemsPerPage = parseInt(value);
    currentPage = 0; // Reset to the first page when items per page changes
    loadGalaxies();

    // Enable/disable navigation buttons
    document.getElementById("prevBtn").disabled = true;
    document.getElementById("nextBtn").disabled = false;
}

function previousPage() {
    if (currentPage > 0) {
        currentPage--;
        loadGalaxies();
    }

    // Update button states
    document.getElementById("prevBtn").disabled = currentPage === 0;
    document.getElementById("nextBtn").disabled = false;
}

function nextPage() {
    currentPage++;
    loadGalaxies();

    // Example condition to disable the "Next" button
    // Replace this with your logic for determining the total pages
    const maxPages = 10; // Placeholder for demonstration
    document.getElementById("nextBtn").disabled = currentPage >= maxPages - 1;

    // Enable the "Previous" button
    document.getElementById("prevBtn").disabled = currentPage === 0;
}

// Initial load
loadGalaxies();

async function executeWikidataRequest(query, callback) {
    try {
        // Construct the SPARQL query URL for Wikidata
        const wikidataEndpoint = "https://query.wikidata.org/sparql";
        const url = wikidataEndpoint + "?query=" + encodeURIComponent(query) + "&format=json";

        // Send the request to the Wikidata server asynchronously
        const response = await fetch(url, {
            headers: { "User-Agent": "YourAppName/1.0 (YourEmail@example.com)" } // Set a user agent (optional but recommended)
        });

        // Check if the response is OK (status 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the response JSON
        const data = await response.json();

        // Invoke the callback with the results
        callback(true, data);
    } catch (error) {
        console.error("An error occurred:", error.message);

        // Invoke the callback with an error indicator
        callback(false, error.message);
    }
}


async function executeRequest(request, callback) {
    try {
        // Construct the SPARQL query URL
        const url_base = "http://dbpedia.org/sparql";
        const url = url_base + "?query=" + encodeURIComponent(request) + "&format=json";

        // Send the request to the server asynchronously
        const response = await fetch(url);

        // Check if the response is OK (status 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Parse the response JSON
        const data = await response.json();

        // Invoke the callback with the results
        callback(true, data);
    } catch (error) {
        console.error("An error occurred:", error.message);

        // Invoke the callback with an error indicator
        callback(false, error.message);
    }
}
