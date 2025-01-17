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
            const template = document.getElementById("galaxy-card-template");
            
            if (!template) {
                console.error("Template not found!");
                resultsSection.innerHTML = `
                    <div class="glass rounded-xl p-6 text-center">
                        <p class="text-red-400">Error: Template not found</p>
                    </div>
                `;
                return;
            }

            resultsSection.innerHTML = ""; // Clear previous results

            if (!data.results || !data.results.bindings || data.results.bindings.length === 0) {
                resultsSection.innerHTML = `
                    <div class="glass rounded-xl p-6 text-center">
                        <p class="text-gray-400">No galaxies found. Please try adjusting your search criteria.</p>
                </div>
                `;
                return;
            }

            data.results.bindings.forEach(element => {
                try {
                    const clone = template.content.cloneNode(true);
                    
                    // Set image with error handling
                    const img = clone.querySelector("img");
                    if (img) {
                        img.src = element.imgUrl.value;
                        img.alt = element.name.value;
                        // Add error handler for images
                        img.onerror = function() {
                            this.src = 'placeholder-galaxy.jpg';
                            this.alt = 'Image not available';
                        };
                    }

                    // Set title
                    const title = clone.querySelector("h3");
                    if (title) {
                        title.textContent = element.name.value;
                    }

                    // Set description
                    const desc = clone.querySelector("p");
                    if (desc) {
                        const description = element.description ? 
                            element.description.value.substring(0, 150) + "..." : 
                            "No description available";
                        desc.textContent = description;
                    }

                    // Set metadata
                    const spans = clone.querySelectorAll(".flex.gap-4 span");
                    if (spans.length >= 2) {
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
                    }

                    resultsSection.appendChild(clone);
                } catch (error) {
                    console.error("Error creating galaxy card:", error);
                }
            });

            // Update current page display if the element exists
            const currentPageElement = document.getElementById("currentPage");
            if (currentPageElement) {
                currentPageElement.innerText = `Page: ${currentPage + 1}`;
            }
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

function search() {
    const searchQuery = document.getElementById("searchInput").value;
    const searchInFilter = document.getElementById("searchInFilter").value;
    const sortFilter = document.getElementById("sortFilter").value;
    const hasImage = document.getElementById("hasImageFilter").checked;
    const hasDescription = document.getElementById("hasDescriptionFilter").checked;
    
    // Reset to first page when searching
    currentPage = 0;
    
    // Build the SPARQL query with search conditions
    let req = `
    PREFIX dbo: <http://dbpedia.org/ontology/>
    PREFIX dbp: <http://dbpedia.org/property/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    
    SELECT DISTINCT ?x ?name ?imgUrl ?description ?distance WHERE {
        ?x a dbo:Galaxy ;
           rdfs:label ?name ;
           dbo:thumbnail ?imgUrl .
        OPTIONAL { ?x dbo:abstract ?description }
        OPTIONAL { ?x dbo:distance ?distance }
        
        # Language filters
        FILTER(lang(?name) = 'en')
        FILTER(lang(?description) = 'en' || !bound(?description))
        
        # Search filters
        ${searchQuery ? getSearchFilter(searchQuery, searchInFilter) : ''}
        
        # Feature filters
        ${hasImage ? 'FILTER(bound(?imgUrl))' : ''}
        ${hasDescription ? 'FILTER(bound(?description))' : ''}
    }
    ${getSortClause(sortFilter)}
    LIMIT ${itemsPerPage}
    OFFSET ${currentPage * itemsPerPage}
    `;

    console.log("Search query:", req);

    executeRequest(req, function(state, data) {
        if (state) {
            displayResults(data);
        }
    });
}

function getSearchFilter(query, searchIn) {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    switch(searchIn) {
        case 'name':
            return `FILTER(regex(?name, "${escapedQuery}", "i"))`;
        case 'description':
            return `FILTER(regex(?description, "${escapedQuery}", "i"))`;
        case 'both':
        default:
            return `FILTER(regex(?name, "${escapedQuery}", "i") || regex(?description, "${escapedQuery}", "i"))`;
    }
}

function getSortClause(sortBy) {
    switch(sortBy) {
        case 'distance':
            return 'ORDER BY ?distance';
        case 'name':
        default:
            return 'ORDER BY ?name';
    }
}

function getDistanceFilter(distanceFilter) {
    switch(distanceFilter) {
        case 'near':
            return 'FILTER(?distance < 30856775814913673000)'; // < 1M light years
        case 'medium':
            return 'FILTER(?distance >= 30856775814913673000 && ?distance < 3085677581491367300000)'; // 1M-100M light years
        case 'far':
            return 'FILTER(?distance >= 3085677581491367300000)'; // > 100M light years
        default:
            return '';
    }
}

function toggleFilters() {
    const filterSection = document.getElementById("filterSection");
    if (filterSection.classList.contains("hidden")) {
        filterSection.classList.remove("hidden");
    } else {
        filterSection.classList.add("hidden");
    }
}

function displayResults(data) {
    const resultsSection = document.getElementById("results");
    const template = document.getElementById("galaxy-card-template");
    
    if (!template) {
        console.error("Template not found!");
        resultsSection.innerHTML = `
            <div class="glass rounded-xl p-6 text-center">
                <p class="text-red-400">Error: Template not found</p>
            </div>
        `;
        return;
    }

    resultsSection.innerHTML = ""; // Clear previous results
    
    if (!data.results || !data.results.bindings || data.results.bindings.length === 0) {
        resultsSection.innerHTML = `
            <div class="glass rounded-xl p-6 text-center">
                <p class="text-gray-400">No galaxies found. Please try adjusting your search criteria.</p>
            </div>
        `;
        return;
    }

    data.results.bindings.forEach(element => {
        try {
            const clone = template.content.cloneNode(true);
            
            // Set image with error handling
            const img = clone.querySelector("img");
            if (img) {
                img.src = element.imgUrl.value;
                img.alt = element.name.value;
                img.onerror = function() {
                    this.src = 'placeholder-galaxy.jpg';
                    this.alt = 'Image not available';
                };
            }

            // Set title
            const title = clone.querySelector("h3");
            if (title) {
                title.textContent = element.name.value;
            }

            // Set description
            const desc = clone.querySelector("p");
            if (desc) {
                const description = element.description ? 
                    element.description.value.substring(0, 150) + "..." : 
                    "No description available";
                desc.textContent = description;
            }

            // Set metadata
            const spans = clone.querySelectorAll(".flex.gap-4 span");
            if (spans.length >= 2) {
                if (element.distance) {
                    spans[0].textContent = `Distance: ${Math.round(element.distance.value / 30856775814913673).toLocaleString()} light years`;
                } else {
                    spans[0].textContent = "Distance: Unknown";
                }
                
                // Remove type display since we don't have reliable type data
                spans[1].textContent = "";
            }

            resultsSection.appendChild(clone);
        } catch (error) {
            console.error("Error creating galaxy card:", error);
        }
    });
}
