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
    PREFIX dbo: <http://dbpedia.org/ontology/>
    PREFIX dbp: <http://dbpedia.org/property/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?x ?name ?imgUrl ?description ?distance ?type WHERE {
        ?x a dbo:Galaxy ;
           rdfs:label ?name ;
           dbo:thumbnail ?imgUrl .
        OPTIONAL { ?x dbo:abstract ?description }
        OPTIONAL { ?x dbo:distance ?distance }
        OPTIONAL { ?x dbo:type ?type }
        FILTER(lang(?name) = 'en')
        FILTER(lang(?description) = 'en' || !bound(?description))
    }
    ORDER BY ?name
    LIMIT ${itemsPerPage}
    OFFSET ${offset}
    `;

    console.log("Executing SPARQL query:", req);

    executeRequest(req, function (state, data) {
        if (state) {
            console.log("Received data:", data);
            const resultsSection = document.getElementById("results");
            resultsSection.innerHTML = ""; // Clear previous results
            
            if (!data.results || !data.results.bindings || data.results.bindings.length === 0) {
                resultsSection.innerHTML = `
                    <div class="glass rounded-xl p-6 text-center">
                        <p class="text-gray-400">No galaxies found. Please try adjusting your search criteria.</p>
                    </div>
                `;
                return;
            }

            const template = document.getElementById("galaxy-card-template");

            data.results.bindings.forEach(element => {
                const clone = template.content.cloneNode(true);
                
                // Set image
                const img = clone.querySelector("img");
                img.src = element.imgUrl.value;
                img.alt = element.name.value;

                // Set title
                clone.querySelector("h3").textContent = element.name.value;

                // Set description
                const description = element.description ? 
                    element.description.value.substring(0, 150) + "..." : 
                    "No description available";
                clone.querySelector("p").textContent = description;

                // Set metadata
                const spans = clone.querySelectorAll(".flex.gap-4 span");
                if (element.distance) {
                    spans[0].textContent = `Distance: ${Math.round(element.distance.value / 30856775814913673).toLocaleString()} light years`;
                } else {
                    spans[0].textContent = "Distance: Unknown";
                }
                
                if (element.type) {
                    spans[1].textContent = `Type: ${element.type.value.split("/").pop()}`;
                } else {
                    spans[1].textContent = "Type: Unknown";
                }

                resultsSection.appendChild(clone);
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
        const url_base = "https://dbpedia.org/sparql";
        const url = url_base + "?query=" + encodeURIComponent(request) + "&format=json";
        console.log("Sending request to:", url);

        // Send the request to the server asynchronously
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json',
                'User-Agent': 'AstronomicalExplorer/1.0'
            }
        });

        // Check if the response is OK (status 200-299)
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
        }

        // Parse the response JSON
        const data = await response.json();
        console.log("Response received:", data);

        // Invoke the callback with the results
        callback(true, data);
    } catch (error) {
        console.error("An error occurred:", error);
        callback(false, error.message);
        
        // Show error message in the results section
        const resultsSection = document.getElementById("results");
        resultsSection.innerHTML = `
            <div class="glass rounded-xl p-6 text-center">
                <p class="text-red-400">Error loading galaxies. Please try again later.</p>
                <p class="text-gray-400 text-sm mt-2">${error.message}</p>
            </div>
        `;
    }
}
