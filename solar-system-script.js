// Update distance range value display
const distanceRange = document.getElementById('distanceRange');
const distanceValue = document.getElementById('distanceValue');

distanceRange.addEventListener('input', function() {
    distanceValue.textContent = this.value;
});

function buildSparqlQuery() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    const minPlanets = document.getElementById('minPlanets').value;
    const maxPlanets = document.getElementById('maxPlanets').value;
    const distance = document.getElementById('distanceRange').value;
    const starType = document.getElementById('starType').value;
    const hasHabitablePlanets = document.getElementById('habitablePlanets').value;
    const hostGalaxy = document.getElementById('hostGalaxy').value.trim();

    let query = `
        PREFIX dbo: <http://dbpedia.org/ontology/>
        PREFIX dbr: <http://dbpedia.org/resource/>
        PREFIX dbp: <http://dbpedia.org/property/>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX yago: <http://dbpedia.org/class/yago/>
        PREFIX dct: <http://purl.org/dc/terms/>
        
        SELECT DISTINCT ?system ?name ?description ?numberOfPlanets ?distance ?starType ?hostGalaxy ?hasHabitable
        WHERE {
            {
                ?system a dbo:PlanetarySystem ;
                       rdfs:label ?name ;
                       dbo:abstract ?description .
            } UNION {
                ?system dct:subject <http://dbpedia.org/resource/Category:Planetary_systems> ;
                       rdfs:label ?name ;
                       dbo:abstract ?description .
            }
            
            FILTER(LANG(?name) = "fr" || LANG(?name) = "en")
            FILTER(LANG(?description) = "fr" || LANG(?description) = "en")
            
            OPTIONAL { 
                {
                    ?system dbp:planets ?numberOfPlanets 
                } UNION {
                    ?system dbo:numberOfPlanets ?numberOfPlanets
                }
            }
            OPTIONAL { 
                {
                    ?system dbp:distance ?distance
                } UNION {
                    ?system dbo:distance ?distance
                }
            }
            OPTIONAL {
                {
                    ?system dbp:starType ?starType
                } UNION {
                    ?system dbo:starType ?starType
                }
            }
            OPTIONAL { 
                {
                    ?system dbp:galaxy ?hostGalaxy .
                    ?hostGalaxy rdfs:label ?galaxyName .
                } UNION {
                    ?system dbo:galaxy ?hostGalaxy .
                    ?hostGalaxy rdfs:label ?galaxyName .
                }
                FILTER(LANG(?galaxyName) = "fr" || LANG(?galaxyName) = "en")
            }
            OPTIONAL {
                {
                    ?system dbp:habitableZone ?hasHabitable
                } UNION {
                    ?system dbo:habitablePlanet ?hasHabitable
                }
            }
    `;

    // Add search term filter if provided
    if (searchTerm) {
        query += `
            FILTER(CONTAINS(LCASE(?name), LCASE("${searchTerm}")) || 
                   CONTAINS(LCASE(?description), LCASE("${searchTerm}")))
        `;
    }

    // Add number of planets filter if provided
    if (minPlanets) {
        query += `FILTER(?numberOfPlanets >= ${minPlanets})`;
    }
    if (maxPlanets) {
        query += `FILTER(?numberOfPlanets <= ${maxPlanets})`;
    }

    // Add distance filter
    if (distance && distance !== "5000") {
        query += `FILTER(?distance <= ${distance})`;
    }

    // Add star type filter
    if (starType && starType !== 'all') {
        query += `FILTER(CONTAINS(LCASE(STR(?starType)), LCASE("${starType}")))`;
    }

    // Add habitable planets filter
    if (hasHabitablePlanets && hasHabitablePlanets !== 'all') {
        query += `FILTER(EXISTS { ?system dbp:habitableZone ?hz } = ${hasHabitablePlanets === 'yes'})`;
    }

    // Add host galaxy filter
    if (hostGalaxy) {
        query += `FILTER(CONTAINS(LCASE(?galaxyName), LCASE("${hostGalaxy}")))`;
    }

    query += `} ORDER BY ?name LIMIT 50`;
    
    console.log('SPARQL Query:', decodeURIComponent(query)); // For debugging
    return encodeURIComponent(query);
}

async function searchSolarSystems() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div class="text-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div><p class="mt-4 text-gray-400">Recherche en cours...</p></div>';

    const query = buildSparqlQuery();
    const endpoint = 'https://dbpedia.org/sparql';
    const url = `${endpoint}?query=${query}&format=json`;

    try {
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/sparql-results+json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('DBPedia response:', data); // For debugging
        displayResults(data.results.bindings);
    } catch (error) {
        console.error('Search error:', error); // For debugging
        resultsDiv.innerHTML = `
            <div class="glass rounded-2xl p-6 text-center text-red-400">
                <p>Une erreur est survenue lors de la recherche. Veuillez réessayer.</p>
                <p class="text-sm mt-2">${error.message}</p>
            </div>
        `;
    }
}

function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    
    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `
            <div class="glass rounded-2xl p-6 text-center text-gray-400">
                <p>Aucun système planétaire trouvé avec ces critères.</p>
            </div>
        `;
        return;
    }

    resultsDiv.innerHTML = results.map(result => `
        <div class="glass rounded-2xl p-6 hover:bg-white/5 transition-colors cursor-pointer" 
             onclick="showSystemDetails('${encodeURIComponent(JSON.stringify(result))}')">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                    ${result.name ? result.name.value : 'Système sans nom'}
                </h3>
                <span class="result-type px-3 py-1 rounded-full text-xs text-cyan-400">
                    Système Planétaire
                </span>
            </div>
            ${result.numberOfPlanets ? `
                <p class="text-gray-300 mb-2">
                    <span class="font-medium">Nombre de planètes:</span> ${result.numberOfPlanets.value}
                </p>
            ` : ''}
            ${result.distance ? `
                <p class="text-gray-300 mb-2">
                    <span class="font-medium">Distance:</span> ${result.distance.value} années-lumière
                </p>
            ` : ''}
            ${result.starType ? `
                <p class="text-gray-300 mb-2">
                    <span class="font-medium">Type d'étoile:</span> ${result.starType.value}
                </p>
            ` : ''}
            ${result.hostGalaxy ? `
                <p class="text-gray-300 mb-2">
                    <span class="font-medium">Galaxie:</span> ${result.hostGalaxy.value}
                </p>
            ` : ''}
            ${result.hasHabitable ? `
                <p class="text-gray-300 mb-2">
                    <span class="font-medium">Zone habitable:</span> Oui
                </p>
            ` : ''}
            <p class="text-gray-400 text-sm mt-4 line-clamp-3">
                ${result.description ? result.description.value : 'Aucune description disponible'}
            </p>
        </div>
    `).join('');
}

function showSystemDetails(systemData) {
    const system = JSON.parse(decodeURIComponent(systemData));
    const modal = document.getElementById('detailModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');

    modalTitle.textContent = system.name ? system.name.value : 'Système sans nom';
    modalContent.innerHTML = `
        <div class="space-y-4">
            ${system.description ? `
                <p class="text-gray-300">${system.description.value}</p>
            ` : ''}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                ${system.numberOfPlanets ? `
                    <div class="glass rounded-xl p-4">
                        <h4 class="font-medium text-cyan-400 mb-2">Nombre de planètes</h4>
                        <p class="text-white">${system.numberOfPlanets.value}</p>
                    </div>
                ` : ''}
                ${system.distance ? `
                    <div class="glass rounded-xl p-4">
                        <h4 class="font-medium text-cyan-400 mb-2">Distance</h4>
                        <p class="text-white">${system.distance.value} années-lumière</p>
                    </div>
                ` : ''}
                ${system.starType ? `
                    <div class="glass rounded-xl p-4">
                        <h4 class="font-medium text-cyan-400 mb-2">Type d'étoile</h4>
                        <p class="text-white">${system.starType.value}</p>
                    </div>
                ` : ''}
                ${system.hostGalaxy ? `
                    <div class="glass rounded-xl p-4">
                        <h4 class="font-medium text-cyan-400 mb-2">Galaxie</h4>
                        <p class="text-white">${system.hostGalaxy.value}</p>
                    </div>
                ` : ''}
                ${system.hasHabitable ? `
                    <div class="glass rounded-xl p-4">
                        <h4 class="font-medium text-cyan-400 mb-2">Zone habitable</h4>
                        <p class="text-white">Oui</p>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('active');
}

// Close modal when clicking outside
document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Add event listener for Enter key on search input
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchSolarSystems();
    }
}); 